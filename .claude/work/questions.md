# Open Questions

## Open
- Should the fork re-add a CI workflow (nightly/release) targeting the `taylorlbird` namespace, or stay CI-free? (deferred 2026-07-08)
- Full independence: build our own `taylorlbird` base/healthcheck images, or keep depending on `louislam` public base layers at build time?
- Do we want a full rebrand of the remaining `louislam/dockge` GitHub URLs and in-app update-check links?

## Resolved
- Docker Hub namespace for the fork? → `taylorlbird` (2026-07-08)
- Remove vs disable-in-place the CI workflows? → Delete them; recover from git history if revisited (2026-07-08)
