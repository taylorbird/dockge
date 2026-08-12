# Current Work

**Project**: Dockge (personal fork)
**Objective**: Maintain a personal fork of Dockge and publish arm64 images to the `taylorlbird/dockge` Docker Hub namespace for Raspberry Pi 4/5 deployment.

## Constraints
- Docker Hub namespace is `taylorlbird` (WITH an L); the GitHub fork is `taylorbird` (NO L). Do not confuse them.
- Do NOT rebrand the app — keep the name "Dockge" everywhere; make only targeted changes.
- Image builds are arm64-only for now (Pi 4/5 are arm64). `build:docker` still lists all 3 platforms for later.
- Bump the fork version (`1.5.0-tbird.N`) on each deployable push (immutable tags + a visible confirmation on the About screen).
- Docker images publish under `taylorlbird`, never `louislam`.
- Upstream GitHub CI workflows are intentionally removed for now (revisit before relying on any automation).

## Current Focus
Version 1.5.0-tbird.3 shipped: sidebar Servers panel (shows connected agents with status dots + stack counts; click to filter/navigate), sticky per-server group headers in stack list, new ServerDetail page (route `/server/:endpoint`) with agent URL + online/offline badge + stat tiles + live CPU/memory sparkline charts (5s polling of dockerStats event), and new SparklineChart.vue component. Published arm64 image to Docker Hub (`taylorlbird/dockge:1.5.0-tbird.3`); pushed commit a7bd083 to origin/custom. Awaiting verification on the Raspberry Pi.

## Last Checkpoint
2026-08-11 18:52 PDT

## Next Actions
1. Verify 1.5.0-tbird.3 on the Raspberry Pi (`docker compose pull && docker compose up -d`; About should show 1.5.0-tbird.3).
2. Decide on backend metrics history (SQLite sampler + query API) for real server uptime/performance graphs, or defer to next feature.
3. Optional cleanup pass: statsTimeout module-scope scoping, polling socket-drop resilience, sparkline dot elliptical distortion (cosmetic), deselect navigation UX, unmanaged-stack count accuracy.
4. Standing: re-add CI targeting `taylorlbird` or stay CI-free; build own base/healthcheck images vs keep `louislam` public base layers.
