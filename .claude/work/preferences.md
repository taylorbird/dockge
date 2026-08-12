# User Preferences (candidate — the user reviews these)

<!-- Append dated entries below this marker line, newest first. -->

## 2026-07-08
- Works one single-scoped change at a time: scope one change, get it ready, then build+push the arm64 image to Docker Hub (taylorlbird/dockge) and test it on the Raspberry Pi (4/5). Local, single-user setup.
- Prefers a version bump per deployable push: immutable version tags plus a visible "did the new image land" signal on the About screen to confirm the new image is running.
- Does NOT want an app-wide rebrand of the fork; keep the upstream name "Dockge" and make only targeted changes.
- Uses voice input; transcription quirks appear (e.g. "Docker" for "Dockge", "Dock Edge" for "DockEdge") — read intent past the transcription.
- Values a low-friction tooling setup (e.g. had a misbehaving global Claude hook that was blocking commands fixed).
- Prefers reproducible bootstrap over one-off manual setup: wants a `setup-clawed.sh` script that idempotently ensures all Claude session scaffolding files exist, so the `/session-checkpoint`, `/session-resume`, and `/session-status` skills work on any clone/machine.
- Treats this repo as a personal fork to publish under their own Docker Hub namespace; wants upstream-specific machinery (CI) stripped for a "clean cut."
