# ADR-106 — Headless Core Service Boundary

The Electron UI is not the server. `@ppt/core-service` is introduced as a headless process boundary. It owns policy enforcement and future data/API/cluster orchestration. This release implements lifecycle, health and safe-mode foundations only; service installation, API, storage ownership and cluster behavior remain open.
