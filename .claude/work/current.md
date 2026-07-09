# Current Work

**Project**: Dockge (personal fork)
**Objective**: Maintain a personal fork of Dockge and publish images to the `taylorlbird/dockge` Docker Hub namespace.

## Constraints
- Docker images publish under the `taylorlbird` namespace, never `louislam`.
- Upstream GitHub CI workflows are intentionally removed for now (revisit before relying on any automation).

## Current Focus
Preparing a clean-cut fork to push to Docker Hub: removed upstream CI workflows and retargeted all image names to `taylorlbird/dockge`.

## Last Checkpoint
2026-07-08 15:03 PDT

## Next Actions
1. Revisit GitHub CI — decide whether to re-add a nightly/release workflow that targets the `taylorlbird` namespace (the 5 upstream workflows were deleted 2026-07-08; recover from git history if needed).
2. `docker login` and run `npm run build:docker` to publish `taylorlbird/dockge:latest` (+ `:1`, `:$VERSION`, `:beta`, `:nightly`).
3. (Optional, full independence) Build & push your own base images — `npm run build:healthcheck` then `npm run build:docker-base` — then change the 3 `FROM louislam/dockge:*` lines in `docker/Dockerfile` to `taylorlbird/dockge:*`.
4. (Optional) Rebrand remaining `louislam/dockge` GitHub URLs — README badges/screenshots, CONTRIBUTING/SECURITY, issue & discussion templates, `backend/dockge-server.ts` error message, and the in-app "Check Update" links in `frontend/src/components/settings/About.vue` and `frontend/src/layouts/Layout.vue`.
