# Work Log

<!-- Newest entries are prepended above older ones by /session-checkpoint. -->

## 2026-08-11 18:52

**Session Summary**: Built and shipped version 1.5.0-tbird.3 with a multi-server UX feature set, developed and demoed via local Docker + Vite, then published to Docker Hub and pushed commit a7bd083 to origin/custom. All work was frontend; the new Servers panel (status-dot per-agent, stack counts, click to filter/navigate) sits above the stack list; sticky per-server group headers now show status + counts; the new ServerDetail.vue page displays agent URL, online/offline badge, stat tiles (Active/Exited/Inactive/Containers), and live CPU/memory sparkline charts updating every 5s via the dockerStats socket event (10-minute rolling buffer); new SparklineChart.vue component with SVG area+line, hover crosshair, and theme-aware colors validated via dataviz palette. Published multi-tag arm64 image and awaiting Pi verification.

**Decisions Made**:
- Server visibility design: Servers overview panel at top of sidebar + sticky group headers + click opens a server detail page (iterated on user feedback: blue dot was unclear, added green/red status, user asked for separate list above stack list, then for click-to-navigate server page like containers).
- Status dot colors: green #4caf50 (online) / $danger red (offline) — blue $primary read as decoration.
- Chart colors: #2e86d9 light mode / #3d90dc dark mode (validated via dataviz palette validator; Dockge $primary #74c2ff fails contrast on white).
- Live-only charts accepted for now; backend metrics history (sampler + SQLite + query API) deferred (user said "we'll probably fix it").

**Actions Taken**:
- Built Servers panel in StackList.vue (shown only when >1 agent connected; one row per agent with status dot + friendly name + running/total stack counts; click filters stack list + navigates to server detail; click again deselects + navigates home).
- Added sticky per-server group headers (position: sticky within scroll container) with status dot + running/total counts.
- Created ServerDetail.vue page at route /server/:endpoint; displays server name + online/offline badge + agent URL + stat tile grid (Active/Exited/Inactive/Containers) + live CPU and Memory sparkline charts; Manage section (rename friendly name via updateAgent, remove agent via removeAgent with confirm modal) for remote agents only.
- Built SparklineChart.vue component: inline SVG area+line, hover crosshair + tooltip (time + value), theme-aware.
- Live stats: page polls dockerStats socket event every 5s via $root.emitAgent(agentKey, "dockerStats", cb); client-side rolling buffer of 120 samples (10 min); CPU = sum per-container; Memory = sum parsed MemUsage.
- Added en.json keys: runningStacksTooltip, servers, stacksOnServer, noStacksOnServer, manageServer, containers, collectingData, serverOfflineStatsMsg.
- Bumped version to 1.5.0-tbird.3 in package.json + package-lock.json.
- Ran `npm run build:frontend`, then `docker buildx build --builder dockge-builder --platform linux/arm64` with multi-tags (latest, 1, 1.5.0-tbird.3) --target release --push.
- Verified on Docker Hub via imagetools inspect (linux/arm64, digest 8eed32e8…).
- Committed a7bd083 "Add server overview panel, server detail page, and live resource charts (1.5.0-tbird.3)" and pushed to origin/custom (reverted auto-gen components.d.ts churn; SparklineChart line added manually per convention).
- Post-push hook ran; verdict LGTM with 5 minor notes (statsTimeout scoping, socket-drop resilience, dot distortion, deselect UX, unmanaged-stack counts).

**Context/Thoughts**:
- Dockge production backend rejects browser socket connections when Origin host ≠ Host header; Node scripts bypass it. For local dev with separate Vite frontend against containerized backend, set NODE_ENV=development on container (enables cors origin:* + origin-check bypass; also UPTIME_KUMA_WS_ORIGIN_CHECK=bypass but doesn't add CORS headers).
- Dev frontend hard-codes backend at location.hostname:5001 when NODE_ENV=development; Vite auto-increments its port if 5000/5001 busy (macOS AirPlay often holds 5000).
- Dockge instances seed headlessly via socket.io-client: emit "setup"(username, password), "login"({username,password,token:""}), "addAgent"({url,username,password,name}). ESM scripts outside repo need absolute path to node_modules/socket.io-client/build/esm/index.js.
- A dockge instance can add ITSELF as an agent (url http://localhost:5001) to force agentCount>1 for UI testing. Demo fleets: run N dockge containers on shared docker network, addAgent to http://<container-name>:5001; they all share host daemon so docker compose ls-derived stack lists show every project on every agent as unmanaged.
- dockerStats event: backend runs `docker stats --format json --no-stream`; returns per-container {Name, CPUPerc, MemUsage, MemPerc, NetIO, BlockIO}; frontend pattern: $root.emitAgent(endpoint, "dockerStats", cb), 5s setTimeout chain.
- agentList/agentStatusList keyed by endpoint with "" = local agent; StackList groups use "current" for local agent — need to translate between the two.
- Dockge frontend lint: eslint covers **/*.{ts,vue} only; object-property-newline enforced — run npx eslint --fix.
- dataviz palette validator OKLCH lightness bands: light 0.43–0.77, dark 0.48–0.67; $primary #74c2ff fails on white (contrast 1.93:1).

## 2026-07-08 21:26

**Session Summary**: Completed the About/version story for the fork and published working arm64 images to Docker Hub for the Raspberry Pi target. Bumped the fork to version `1.5.0-tbird.2` (based on upstream Dockge `1.5.0`), wired the backend/frontend to surface a "Based on Dockge: 1.5.0" line in About, resolved the frontend/backend version-mismatch warning, and retargeted all in-app update/error links to `github.com/taylorbird/dockge` while keeping the upstream `dockge.kuma.pet` version check. Added a friendly agent name in the sidebar (only when more than one agent is connected), built and pushed multi-tag arm64 images via a dedicated buildx builder, committed and pushed two commits to `origin/custom`, and fixed the global `~/.claude/settings.json` hooks so the review/pattern-detector agents only run on the intended git commands.

**Decisions Made**:
- arm64-only publishing for now: the deployment target is a Pi 4/5, so we build/push only linux/arm64 even though `build:docker` still lists all 3 platforms for later multi-arch work.
- Version bump per deployable push (`1.5.0-tbird.1` -> `1.5.0-tbird.2`): immutable tags plus a Pi-side update confirmation, so each pushed image is uniquely identifiable.
- Keep `docker/Dockerfile` `FROM louislam/dockge` base images: zero-bootstrap builds, no need to publish our own base/healthcheck images first.
- Sidebar update button and the new About info banner point to main Dockge (chose Q2 over Q3 phrasing) rather than the fork.
- No rebrand: keep the name "Dockge" throughout; only add the "based on" attribution.
- Delete CI workflows rather than disable: git history recovers them if needed.

**Actions Taken**:
- Set `package.json` `version` to `1.5.0-tbird.2` and added `upstreamVersion` `1.5.0`; backend `sendInfo` now emits `baseVersion`.
- About page shows "Based on Dockge: 1.5.0"; ensured `FRONTEND_VERSION` (vite define from `npm_package_version`) matches backend `packageJSON.version` to clear the mismatch warning; added 3 `en.json` keys.
- Retargeted "Check Update On GitHub" and the backend error URL to `github.com/taylorbird/dockge`; kept the `dockge.kuma.pet` update check; pointed the sidebar update button + About info banner to main Dockge.
- Fixed `Layout.vue` `hasNewVersion` to compare `latestVersion` against `baseVersion` (not `version`), so the fork's suffix doesn't spuriously trigger the update indicator.
- Added sidebar friendly name via `StackList.vue` `endpointDisplayFunction` (shown only when >1 agent).
- Published arm64 images with buildx builder `dockge-builder` (`build --load` then `docker push --all-tags`): `taylorlbird/dockge:{latest,1,1.5.0-tbird.1}` then `{...,1.5.0-tbird.2}`.
- Commits `bfd14de` "Prepare taylorlbird/dockge fork" (15 files) and `11f62de` "Add Claude Code session scaffolding" (12 files) pushed to `origin/custom`; reverted auto-generated `components.d.ts` churn; gitignored `settings.local.json`.
- Fixed `~/.claude/settings.json` hooks with `if`-conditions: push-review PreToolUse agent scoped to `git push` only; pattern-detector PostToolUse agent scoped to git commands only (applied after explicit user OK, since the self-modification classifier initially blocked it).

**Context/Thoughts**:
- Identifiers to remember: Docker Hub namespace = `taylorlbird` (with an L), GitHub = `taylorbird` (no L). Easy to swap by mistake.
- Node version gotcha: host Node v23.6.1 vs project Node 22 -> `node-pty` native build fails on the host. Use `npm ci --ignore-scripts` to get vite working for the frontend build; the image builds prod deps inside the arm64 container fine.
- `FRONTEND_VERSION` must equal backend `packageJSON.version` or About shows a mismatch warning. Upstream `:nightly` mismatches due to mark-as-nightly.
- Docker push `insufficient_scope` error = authenticated but pushing to the wrong namespace.
- Hook `if` field scopes when a hook runs — this is how we constrained the push-review and pattern-detector agents to specific git commands.
- Many `louislam/dockge` GitHub URL references still remain (README badges/screenshots, CONTRIBUTING/SECURITY, issue templates); cosmetic, left as-is.

## 2026-07-08 15:03

**Session Summary**: Prepared the Dockge fork for a clean cut to Docker Hub under the `taylorlbird` namespace, and bootstrapped the Claude session scaffolding (work files, learnings, memory, and a `setup-clawed.sh` bootstrap script).

**Decisions Made**:
- Delete the 5 GitHub CI workflows outright rather than disable-in-place: cleanest tree, recoverable from git history when revisited.
- Namespace = `taylorlbird`.
- Retarget every publish `-t` tag in `package.json` to `taylorlbird/dockge`, but leave `docker/Dockerfile`'s `FROM louislam/dockge:*` base-image lines untouched so `npm run build:docker` works immediately using upstream's public base layers (no bootstrap step required).

**Actions Taken**:
- Deleted `.github/workflows/{ci,nightly-release,close-incorrect-issue,json-yaml-validate,prevent-file-change}.yml`.
- Retargeted `louislam/dockge` → `taylorlbird/dockge` in `package.json` (all scripts), `compose.yaml`, and the README compose example.
- Created `.claude/work/` + `.claude/learnings/` scaffolding, global memory `MEMORY.md` + `dockge-fork.md`, and `setup-clawed.sh`.
- Added `.claude/work/` and `.claude/learnings/` to `.gitignore` to keep the public fork clean.

**Context/Thoughts**:
- Many `louislam/dockge` *GitHub URL* references remain (README badges/screenshots, CONTRIBUTING/SECURITY, issue templates, backend error message, in-app update-check links, `extra/reformat-changelog.ts`). These are cosmetic/functional, not Docker images — left as-is; rebrand later if desired.
- Full Docker independence requires building your own `:base` and `:build-healthcheck` images first, then flipping the 3 Dockerfile `FROM` lines. See `.claude/learnings/docker-publishing.md`.
