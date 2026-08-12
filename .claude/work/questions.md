# Open Questions

## Open
- Should the fork re-add a CI workflow (nightly/release) targeting the `taylorlbird` namespace, or stay CI-free? (deferred 2026-07-08)
- Full independence: build our own `taylorlbird` base/healthcheck images, or keep depending on `louislam` public base layers at build time?
- Implement backend metrics history (sampler + SQLite store + query API) for real server uptime/performance graphs on the server detail page, or defer as a future feature? (deferred 2026-08-11; user signaled "we'll probably fix it")

## Resolved
- Docker Hub namespace for the fork? → `taylorlbird` (2026-07-08)
- Remove vs disable-in-place the CI workflows? → Delete them; recover from git history if revisited (2026-07-08)
- Do we want a full rebrand of the app / remaining `louislam/dockge` GitHub URLs and in-app update-check links? → NO rebrand; keep the name "Dockge" (2026-07-08)
- Misbehaving global git hook → Fixed via if-conditions in `~/.claude/settings.json` (2026-07-08)
- Sidebar agent friendly-name display → Done (2026-07-08)
- About-page version display (fork version + "Based on Dockge" base version; mismatch warning removed) → Done (2026-07-08)
