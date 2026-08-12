# Docker Publishing — taylorlbird/dockge fork

## Image build chain
- `docker/Dockerfile` is multi-stage and pulls two prerequisite base images at build time:
  - `FROM louislam/dockge:build-healthcheck` (compiled healthcheck binary)
  - `FROM louislam/dockge:base` (Node + system deps; used for both the `build` and `release` stages)
- Those base images are produced by:
  - `npm run build:docker-base` → pushes `:base`
  - `npm run build:healthcheck` → pushes `:build-healthcheck`
- The release image (`npm run build:docker`, invoked by `release-final`) builds on `:base` and publishes the user-facing tags: `:latest`, `:1`, `:$VERSION`, `:beta`, `:nightly`. `release-nightly` also pushes to `ghcr.io`.

## Fork retargeting (2026-07-08)
- Every `-t` publish tag in `package.json` now targets `taylorlbird/dockge` (including `ghcr.io/taylorlbird/dockge` in `release-nightly`). Also updated: `compose.yaml` and the README compose example.
- The Dockerfile `FROM` lines were intentionally **left** on `louislam/dockge:base` / `:build-healthcheck`, so `npm run build:docker` works immediately by pulling upstream's public base layers — no bootstrap required.

## Path to full independence (no upstream dependency)
1. `docker login` (as `taylorlbird`).
2. `npm run build:healthcheck`   # pushes taylorlbird/dockge:build-healthcheck
3. `npm run build:docker-base`   # pushes taylorlbird/dockge:base
4. Edit `docker/Dockerfile`: change the 3 `FROM louislam/dockge:*` lines → `taylorlbird/dockge:*`.
5. `npm run build:docker`.

## Gotcha
- Build **order** matters for full independence: `:build-healthcheck` and `:base` must exist in your registry before a release build can `FROM` them. Skipping steps 2–3 makes step 5 fail with a manifest-not-found error.

## Build environment (Apple Silicon + OrbStack)
- Host Mac is Apple Silicon (arm64); Docker runs via OrbStack.
- Dedicated buildx builder (create once):
  `docker buildx create --name dockge-builder --driver docker-container --bootstrap`
- Target is Raspberry Pi 4/5, which are arm64 — build **arm64 only**. No amd64/arm-v7 needed. arm64 builds are native on this host, so they're fast.

## Fast arm64 publish flow (current fork version: 1.5.0-tbird.2)
1. Set the version in **both** `package.json` and `package-lock.json` — in each file update the top-level `version` **and** `packages[""].version`.
2. `npm run build:frontend`  # bakes FRONTEND_VERSION from npm_package_version (see Version-match below)
3. Build for arm64 with the dedicated builder:
   `docker buildx build --builder dockge-builder --platform linux/arm64 -t taylorlbird/dockge:latest -t taylorlbird/dockge:1 -t taylorlbird/dockge:<version> --target release -f ./docker/Dockerfile . --load`
4. `docker push --all-tags taylorlbird/dockge`
- The `--load`-then-`push` split was a workaround for a hook that blocked `--push`. That hook is now fixed, so `docker buildx build … --push` directly is fine going forward.

## Local `npm ci` / node-pty gotcha
- Host Node is v23.6.1 but the project targets Node 22; a plain `npm ci` fails compiling `@homebridge/node-pty-prebuilt-multiarch`.
- Use `npm ci --ignore-scripts` locally — it still installs vite, so `npm run build:frontend` works (the frontend does not need node-pty).
- The Docker image builds prod deps **inside** the arm64 container, where node-pty compiles fine — so the local skip doesn't affect the image.

## Version-match mechanic (frontend vs backend)
- Frontend version = `FRONTEND_VERSION`, a Vite `define` fed from `process.env.npm_package_version`, which is only set when the build runs via an npm script. It is **baked at build time**.
- Backend version = `packageJSON.version` at runtime.
- They **must match** or the About page shows "Frontend Version do not match backend version!".
- This is why upstream `:nightly` mismatches: `mark-as-nightly` rewrites the backend version *after* the frontend was already built.

## Namespace gotcha
- A push failing with `insufficient_scope: authorization failed` means you're authenticated but pushing to the **wrong namespace** — e.g. `taylorbird` (no L, the GitHub fork name) instead of `taylorlbird` (with L, the Docker Hub name).
- Docker Hub image namespace: `taylorlbird/dockge` (WITH an L). GitHub fork: `taylorbird` (no L). `docker login` creds are stored via osxkeychain.

## baseVersion / "update available" mechanic
- `package.json` has a custom `upstreamVersion` field (currently `1.5.0`).
- Backend `sendInfo` emits it as `info.baseVersion`; About shows "Based on Dockge <baseVersion>".
- `Layout.vue` `hasNewVersion` compares the upstream latest release against `baseVersion` — **not** against the fork version. This matters because a `-tbird.N` prerelease always sorts *below* its release (e.g. `1.5.0-tbird.2` < `1.5.0`), so comparing upstream latest against the fork version would falsely show "update available".
