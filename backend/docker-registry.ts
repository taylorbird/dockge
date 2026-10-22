import fs from "fs";
import os from "os";
import path from "path";
import childProcessAsync from "promisify-child-process";
import { log } from "./log";
import { ValidationError } from "./util-server";

/** The key Docker stores Docker Hub credentials under */
export const DOCKER_HUB_KEY = "https://index.docker.io/v1/";

/** Registry host, optionally with port / path / scheme. Must start with an alphanumeric so it can never be read as a CLI flag. */
const REGISTRY_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.\-_:/[\]]*$/;

export interface RegistryLogin {
    /** The key in config.json "auths" (what `docker logout` expects) */
    server : string;
    username : string;
}

/**
 * Point the Docker CLI at a config dir inside Dockge's data dir, so registry logins made from the UI
 * persist across container recreation via the existing ./data volume.
 * If the user already set DOCKER_CONFIG, respect it.
 * On first run, seed from ~/.docker/config.json so the old "mount /root/.docker" setup keeps working.
 * @param dataDir Dockge data dir
 */
export function initDockerConfigDir(dataDir : string) {
    if (process.env.DOCKER_CONFIG) {
        log.info("registry", `Using DOCKER_CONFIG from environment: ${process.env.DOCKER_CONFIG}`);
        return;
    }

    const dir = path.resolve(dataDir, "docker");
    fs.mkdirSync(dir, {
        recursive: true,
        mode: 0o700,
    });

    // The CLI also looks up plugins (e.g. compose on Docker Desktop) and contexts under DOCKER_CONFIG, so carry those over
    const legacyDir = path.join(os.homedir(), ".docker");
    for (const sub of [ "cli-plugins", "contexts" ]) {
        const target = path.join(legacyDir, sub);
        const link = path.join(dir, sub);
        try {
            // lstat, not existsSync: a dangling link from an earlier start must still count as present
            let linkPresent = true;
            try {
                fs.lstatSync(link);
            } catch (_) {
                linkPresent = false;
            }
            if (fs.existsSync(target) && !linkPresent) {
                fs.symlinkSync(target, link, "dir");
            }
        } catch (e) {
            log.warn("registry", `Cannot link ${link} -> ${target}: ${e instanceof Error ? e.message : e}`);
        }
    }

    const configPath = path.join(dir, "config.json");
    const legacyPath = path.join(legacyDir, "config.json");
    if (!fs.existsSync(configPath) && fs.existsSync(legacyPath)) {
        fs.copyFileSync(legacyPath, configPath);
        fs.chmodSync(configPath, 0o600);
        log.info("registry", `Seeded ${configPath} from ${legacyPath}`);
    }

    process.env.DOCKER_CONFIG = dir;
    log.info("registry", `Docker config dir: ${dir}`);
}

function getConfigPath() : string {
    const dir = process.env.DOCKER_CONFIG || path.join(os.homedir(), ".docker");
    return path.join(dir, "config.json");
}

/**
 * List registries with stored credentials. Never returns secrets.
 */
export function getRegistryLogins() : RegistryLogin[] {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return [];
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
        log.warn("registry", `Cannot parse ${configPath}: ${e instanceof Error ? e.message : e}`);
        return [];
    }

    const auths = config?.auths ?? {};
    const list : RegistryLogin[] = [];

    for (const [ server, entry ] of Object.entries(auths)) {
        let username = "";
        const auth = (entry as { auth? : string })?.auth;
        if (typeof auth === "string" && auth) {
            const decoded = Buffer.from(auth, "base64").toString("utf-8");
            username = decoded.substring(0, decoded.indexOf(":"));
        }
        list.push({
            server,
            username,
        });
    }

    return list.sort((a, b) => a.server.localeCompare(b.server));
}

function validateServer(server : unknown) : string {
    if (typeof server !== "string") {
        throw new ValidationError("Registry must be a string");
    }
    server = server.trim();
    if (server === "" || server === "docker.io") {
        return DOCKER_HUB_KEY;
    }
    if (!REGISTRY_REGEX.test(server as string)) {
        throw new ValidationError("Invalid registry address");
    }
    return server as string;
}

/**
 * `docker login`, passing the password via stdin so it never appears in the process list
 * @param server Registry address ("" or "docker.io" for Docker Hub)
 * @param username Username
 * @param password Password or access token
 */
export async function registryLogin(server : unknown, username : unknown, password : unknown) {
    const target = validateServer(server);
    if (typeof username !== "string" || username.trim() === "") {
        throw new ValidationError("Username is required");
    }
    if (typeof password !== "string" || password === "") {
        throw new ValidationError("Password is required");
    }

    const args = [ "login", "--username", username.trim(), "--password-stdin" ];
    if (target !== DOCKER_HUB_KEY) {
        args.push(target);
    }

    const child = childProcessAsync.spawn("docker", args, {
        encoding: "utf-8",
    });
    child.stdin?.end(password);

    try {
        await child;
    } catch (e) {
        throw new Error(dockerError(e, "docker login failed"));
    }
}

/**
 * `docker logout`
 * @param server The key from getRegistryLogins()
 */
export async function registryLogout(server : unknown) {
    const target = validateServer(server);
    try {
        await childProcessAsync.spawn("docker", [ "logout", target ], {
            encoding: "utf-8",
        });
    } catch (e) {
        throw new Error(dockerError(e, "docker logout failed"));
    }
}

function dockerError(e : unknown, fallback : string) : string {
    const stderr = (e as { stderr? : unknown })?.stderr;
    if (typeof stderr === "string" && stderr.trim()) {
        // Drop the "WARNING! Your password will be stored unencrypted" noise
        const lines = stderr.split("\n").filter(line => line.trim() && !line.startsWith("WARNING!") && !line.startsWith("Configure a credential helper") && !line.includes("credential-stores"));
        if (lines.length > 0) {
            return lines.join("\n");
        }
    }
    return fallback;
}
