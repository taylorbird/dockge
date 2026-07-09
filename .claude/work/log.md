# Work Log

<!-- Newest entries are prepended above older ones by /session-checkpoint. -->

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
