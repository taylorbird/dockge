import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import childProcessAsync from "promisify-child-process";
import { log } from "./log";
import { DOCKER_HUB_KEY } from "./docker-registry";

/**
 * Detects "a newer image is behind the same tag" for each stack:
 * compares the digest of the image each running container uses against the registry's current digest for that tag.
 * Registry lookups are HEAD requests on the manifest, which Docker Hub does not count against pull limits.
 */

const REQUEST_TIMEOUT_MS = 15 * 1000;

const MANIFEST_ACCEPT = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
].join(", ");

export type ServiceUpdateStatus = "up-to-date" | "update-available" | "unknown";

export interface ServiceImageUpdate {
    service : string;
    image : string;
    status : ServiceUpdateStatus;
    /** Why the status is unknown (local build, pinned digest, registry error) */
    reason? : string;
}

export interface StackImageUpdate {
    updateAvailable : boolean;
    services : ServiceImageUpdate[];
    checkedAt : string;
}

interface ImageRef {
    /** Registry host as used for auth lookup, e.g. "docker.io", "ghcr.io", "localhost:5055" */
    registry : string;
    repository : string;
    tag : string;
}

/** stackName -> last check result (this agent's stacks only) */
const cache = new Map<string, StackImageUpdate>();

export function getStackImageUpdate(stackName : string) : StackImageUpdate | undefined {
    return cache.get(stackName);
}

/**
 * Parse an image reference the way the Docker CLI does
 * @param image e.g. "nginx", "user/app:1", "ghcr.io/org/app:tag", "localhost:5000/app"
 * @returns Parsed ref, or null for digest-pinned refs (nothing to compare)
 */
export function parseImageRef(image : string) : ImageRef | null {
    if (image.includes("@")) {
        return null;
    }

    let registry = "docker.io";
    let rest = image;
    const firstSlash = image.indexOf("/");
    if (firstSlash !== -1) {
        const first = image.substring(0, firstSlash);
        if (first.includes(".") || first.includes(":") || first === "localhost") {
            registry = first;
            rest = image.substring(firstSlash + 1);
        }
    }

    let tag = "latest";
    const lastColon = rest.lastIndexOf(":");
    if (lastColon !== -1 && !rest.substring(lastColon).includes("/")) {
        tag = rest.substring(lastColon + 1);
        rest = rest.substring(0, lastColon);
    }

    if (registry === "docker.io" && !rest.includes("/")) {
        rest = "library/" + rest;
    }

    return {
        registry,
        repository: rest,
        tag,
    };
}

/**
 * Basic credentials for a registry from DOCKER_CONFIG (only plain "auths" entries; credential helpers are not supported)
 * @param registry Registry host
 * @returns base64 "user:pass" or undefined
 */
function getBasicAuth(registry : string) : string | undefined {
    const dir = process.env.DOCKER_CONFIG || path.join(os.homedir(), ".docker");
    try {
        const config = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf-8"));
        const auths = config?.auths ?? {};
        const keys = registry === "docker.io"
            ? [ DOCKER_HUB_KEY, "docker.io", "index.docker.io", "registry-1.docker.io" ]
            : [ registry, `https://${registry}`, `http://${registry}` ];
        for (const key of keys) {
            const auth = auths[key]?.auth;
            if (typeof auth === "string" && auth) {
                return auth;
            }
        }
    } catch (_) {
        // No config or unreadable: anonymous
    }
    return undefined;
}

function registryBaseURL(registry : string) : string {
    if (registry === "docker.io") {
        return "https://registry-1.docker.io";
    }
    // Docker itself allows plain HTTP for loopback registries
    const host = registry.split(":")[0];
    if (host === "localhost" || host.startsWith("127.")) {
        return `http://${registry}`;
    }
    return `https://${registry}`;
}

/**
 * Parse a WWW-Authenticate header, e.g. Bearer realm="...",service="...",scope="..."
 * @param header Header value
 * @returns scheme and params
 */
function parseAuthenticate(header : string) : { scheme : string, params : Record<string, string> } {
    const space = header.indexOf(" ");
    const scheme = (space === -1 ? header : header.substring(0, space)).toLowerCase();
    const params : Record<string, string> = {};
    const re = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(header)) !== null) {
        params[m[1]] = m[2];
    }
    return {
        scheme,
        params,
    };
}

async function fetchManifest(url : string, method : "HEAD" | "GET", authorization? : string) : Promise<Response> {
    const headers : Record<string, string> = {
        Accept: MANIFEST_ACCEPT,
    };
    if (authorization) {
        headers.Authorization = authorization;
    }
    return fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

/**
 * Current digest of a tag in its registry
 * @param ref Image reference
 * @returns "sha256:..." digest
 */
export async function getRemoteDigest(ref : ImageRef) : Promise<string> {
    const url = `${registryBaseURL(ref.registry)}/v2/${ref.repository}/manifests/${ref.tag}`;
    const basic = getBasicAuth(ref.registry);

    let authorization : string | undefined;
    let res = await fetchManifest(url, "HEAD");

    if (res.status === 401) {
        const challenge = parseAuthenticate(res.headers.get("www-authenticate") ?? "");

        if (challenge.scheme === "bearer" && challenge.params.realm) {
            const tokenURL = new URL(challenge.params.realm);
            if (challenge.params.service) {
                tokenURL.searchParams.set("service", challenge.params.service);
            }
            tokenURL.searchParams.set("scope", challenge.params.scope || `repository:${ref.repository}:pull`);

            const tokenRes = await fetch(tokenURL, {
                headers: basic ? { Authorization: `Basic ${basic}` } : {},
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!tokenRes.ok) {
                throw new Error(`registry token request failed (${tokenRes.status})`);
            }
            const tokenJSON = await tokenRes.json();
            const token = tokenJSON.token || tokenJSON.access_token;
            if (!token) {
                throw new Error("registry returned no token");
            }
            authorization = `Bearer ${token}`;
        } else if (challenge.scheme === "basic" && basic) {
            authorization = `Basic ${basic}`;
        } else {
            throw new Error("registry requires login");
        }

        res = await fetchManifest(url, "HEAD", authorization);
    }

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("not authorized: log in under Settings → Registries");
        }
        if (res.status === 404) {
            throw new Error("tag not found in registry");
        }
        throw new Error(`registry responded ${res.status}`);
    }

    let digest = res.headers.get("docker-content-digest");
    if (!digest) {
        // Some registries omit the header on HEAD; fall back to hashing the manifest body
        const getRes = await fetchManifest(url, "GET", authorization);
        if (!getRes.ok) {
            throw new Error(`registry responded ${getRes.status}`);
        }
        digest = getRes.headers.get("docker-content-digest");
        if (!digest) {
            const body = Buffer.from(await getRes.arrayBuffer());
            digest = "sha256:" + crypto.createHash("sha256").update(body).digest("hex");
        }
    }
    return digest;
}

interface RunningService {
    service : string;
    /** Image reference from the compose file, e.g. "taylorlbird/app:latest" */
    image : string;
    /** Image ID the container was created from */
    imageID : string;
}

async function getRunningServices(stackName : string) : Promise<RunningService[]> {
    const ps = await childProcessAsync.spawn("docker", [
        "ps", "-a", "-q", "--filter", `label=com.docker.compose.project=${stackName}`,
    ], {
        encoding: "utf-8",
    });
    const ids = String(ps.stdout ?? "").split("\n").filter(id => id.trim() !== "");
    if (ids.length === 0) {
        return [];
    }

    const inspect = await childProcessAsync.spawn("docker", [
        "inspect", "--format", "{{json .Config.Labels}}\t{{.Config.Image}}\t{{.Image}}", ...ids,
    ], {
        encoding: "utf-8",
    });

    const services = new Map<string, RunningService>();
    for (const line of String(inspect.stdout ?? "").split("\n")) {
        if (!line.trim()) {
            continue;
        }
        const [ labelsJSON, image, imageID ] = line.split("\t");
        const labels = JSON.parse(labelsJSON) ?? {};
        const service = labels["com.docker.compose.service"] ?? image;
        // One entry per service (replicas share an image)
        services.set(service, {
            service,
            image,
            imageID,
        });
    }
    return [ ...services.values() ];
}

async function getLocalDigests(imageID : string) : Promise<string[]> {
    try {
        const res = await childProcessAsync.spawn("docker", [ "image", "inspect", "--format", "{{json .RepoDigests}}", imageID ], {
            encoding: "utf-8",
        });
        const repoDigests : string[] = JSON.parse(String(res.stdout ?? "[]")) ?? [];
        return repoDigests.map(d => d.substring(d.indexOf("@") + 1));
    } catch (_) {
        // Image removed since the container was created
        return [];
    }
}

/**
 * Check one stack and store the result
 * @param stackName Stack (compose project) name
 * @param remoteCache Optional per-run cache so a shared image is looked up once
 * @returns Result
 */
export async function checkStack(stackName : string, remoteCache = new Map<string, Promise<string>>()) : Promise<StackImageUpdate> {
    const running = await getRunningServices(stackName);
    const services : ServiceImageUpdate[] = [];

    for (const svc of running) {
        const ref = parseImageRef(svc.image);
        if (!ref) {
            services.push({
                service: svc.service,
                image: svc.image,
                status: "unknown",
                reason: "pinned by digest",
            });
            continue;
        }

        const localDigests = await getLocalDigests(svc.imageID);
        if (localDigests.length === 0) {
            services.push({
                service: svc.service,
                image: svc.image,
                status: "unknown",
                reason: "built locally",
            });
            continue;
        }

        const key = `${ref.registry}/${ref.repository}:${ref.tag}`;
        if (!remoteCache.has(key)) {
            remoteCache.set(key, getRemoteDigest(ref));
        }

        try {
            const remote = await remoteCache.get(key)!;
            services.push({
                service: svc.service,
                image: svc.image,
                status: localDigests.includes(remote) ? "up-to-date" : "update-available",
            });
        } catch (e) {
            services.push({
                service: svc.service,
                image: svc.image,
                status: "unknown",
                reason: e instanceof Error ? e.message : String(e),
            });
        }
    }

    const result : StackImageUpdate = {
        updateAvailable: services.some(s => s.status === "update-available"),
        services,
        checkedAt: new Date().toISOString(),
    };
    cache.set(stackName, result);
    return result;
}

/**
 * Check every stack (sequentially, to stay gentle on registries)
 * @param stackNames Stack names
 */
export async function checkStacks(stackNames : string[]) {
    const remoteCache = new Map<string, Promise<string>>();
    let updates = 0;
    for (const name of stackNames) {
        try {
            const res = await checkStack(name, remoteCache);
            if (res.updateAvailable) {
                updates++;
            }
        } catch (e) {
            log.warn("image-update", `Failed to check ${name}: ${e instanceof Error ? e.message : e}`);
        }
    }
    log.info("image-update", `Checked ${stackNames.length} stack(s), ${updates} with image updates`);
}

/** Drop results for stacks that no longer exist */
export function pruneImageUpdates(existing : Set<string>) {
    for (const name of cache.keys()) {
        if (!existing.has(name)) {
            cache.delete(name);
        }
    }
}
