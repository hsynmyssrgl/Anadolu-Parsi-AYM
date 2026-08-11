# ADR-082 — Secure onboarding and user-data vault

## Context
Pre-authentication SQLite opening and external decrypted document handoff conflict with the project privacy constitution.

## Decision
Use a fail-closed encrypted persistent vault with AES-256-GCM content encryption, scrypt password wrapping, Windows safeStorage/DPAPI device protection, ephemeral authenticated-session database materialization, reseal on logout/expiry/quit, and app-internal archive preview. Apple/Google/Microsoft remain authentication providers only; authorization stays local.

## Consequences
Live OIDC remains PENDING until provider registration and Windows tests. In-session page-level protection and sensitive side-artifact closure remain Bronze Final blockers OPEN-021/OPEN-022.
