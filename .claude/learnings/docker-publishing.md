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
