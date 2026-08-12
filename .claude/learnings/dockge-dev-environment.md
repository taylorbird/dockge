# Dockge Development Environment & Socket Patterns

Durable technical learnings about local dev setup, socket seeding, live agent communication, and deployment patterns.

## Local Dev CORS & NODE_ENV

Dockge production backend rejects browser socket connections when the Origin header host doesn't match the Host header, and sends no CORS headers:
```
Origin (...) does not match host (...)
```

**Solution for local dev** (separate Vite frontend against containerized backend):
- Set `NODE_ENV=development` on the backend container
- This enables `cors: {origin: "*"}` and bypasses the origin check
- Alternative env var `UPTIME_KUMA_WS_ORIGIN_CHECK=bypass` skips the check but does NOT add CORS headers
- Node/socket.io scripts run outside the browser (no Origin header), so they connect regardless

## Vite Port Auto-Increment Behavior

Dev frontend (`npm run dev:frontend`) hard-codes backend at `location.hostname:5001` when `NODE_ENV=development`.

**Caveat**: Vite auto-increments its own port if 5000/5001 are busy. On macOS, AirPlay commonly holds 5000, so Vite may start at 5001 (colliding with the backend) or 5002+. Check the dev server startup log to confirm the frontend port.

## Socket.io Seeding (Headless Setup)

Dockge instances can be seeded programmatically without a browser UI via socket.io-client:
```javascript
// Emit sequence:
1. emit("setup", username, password)
2. emit("login", {username, password, token: ""})
3. emit("addAgent", {url, username, password, name})
```

**Important**: ESM scripts running outside the repo cannot use `NODE_PATH`; import socket.io-client by absolute path:
```javascript
import io from ".../node_modules/socket.io-client/build/esm/index.js"
```

## Self-Agent Pattern & Demo Fleets

A Dockge instance can add **itself** as an agent (url: `http://localhost:5001`) — useful to force `agentCount > 1` for UI testing without running multiple backends.

**Multi-agent demo fleet** (headless seeding):
- Run N dockge containers on one shared docker network
- Seed each with addAgent calls to the other containers' http://<container-name>:5001 endpoints
- **Caveat**: all containers share the host daemon, so `docker compose ls`-derived stack lists show every project on every agent as unmanaged entries (not just the agent's own)

## dockerStats Socket Event & Live Polling

The backend's `dockerStats` event (from upstream PR #700) runs `docker stats --format json --no-stream` and returns per-container stats:
```json
{
  Name: "container_name",
  CPUPerc: "0.12%",
  MemUsage: "4.5MiB / 7.6GiB",
  MemPerc: "0.06%",
  NetIO: "...",
  BlockIO: "..."
}
```

**Frontend polling pattern** (from Compose.vue):
```javascript
const stats = ref([])
const poll = () => {
  $root.emitAgent(agentKey, "dockerStats", (response) => {
    stats.value = response  // keyed by container name
    setTimeout(poll, 5000)  // 5s intervals
  })
}
```

For live server graphs: client-side rolling buffer of 120 samples = 10 minutes at 5s intervals. CPU = sum of per-container CPUPerc; Memory = sum of parsed MemUsage bytes.

## Agent Key Translation

- `agentList` and `agentStatusList` are keyed by endpoint: `""` (empty string) = local agent, or `"host:port"` = remote agent
- StackList groups use `"current"` for the local agent
- **Need to translate** between the two in code that switches between scopes (e.g., `"current"` ↔ `""`)

## Frontend Linting Rules

`eslint` is configured to cover only `**/*.{ts,vue}` (JSON files false-error).

**Enforcement**: `object-property-newline` — always run `npx eslint --fix` after adding object literals to components. Auto-gen output like `components.d.ts` may violate this but should be reverted anyway (check git diff).

## Dataviz Palette Validator Bands

For accessible color charts, use OKLCH lightness ranges validated via the dataviz skill:
- **Light mode**: L 0.43–0.77
- **Dark mode**: L 0.48–0.67

**Known failure**: Dockge's `$primary` color #74c2ff has contrast 1.93:1 against white (fails WCAG AA). Valid alternatives: #2e86d9 (light) / #3d90dc (dark) for stat charts.
