# ADR-100 — Platform-actual conversation capacity gate

- Build: 225
- Status: Accepted

Build completion accepts `platform_actual` with an explicit 0–100 value or `platform_actual_unavailable` without a fabricated value. The latter persists `UNMEASURED` and creates no handoff. The ledger validator accepts historical Build207–224 `assistant_estimate` records unchanged but rejects that method for Build225 and later. Handoff creation and the new-build block are conditional only on `platform_actual >= 90`. A new chat acknowledges an actual hard-stop handoff with `NEW_CHAT_HANDOFF_BUILDxxx`.
