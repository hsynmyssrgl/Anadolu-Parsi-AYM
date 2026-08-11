# Release Notes — Bronze RC2 Build227

- Application Version: `02.08.2026.227`
- Package Version: `2.8.2026-227`
- Channel: Bronze RC2 Active Development

Build227 fixes only four exact-Build226 Windows root causes:

- sandbox preload UUID generation no longer imports `node:crypto`;
- long-lived Windows key envelopes use a two-process-proven CurrentUser DPAPI provider;
- installer validation uses short paths, bounded polling and dynamic discovery;
- OPEN-022 no longer treats an unreported selected backend name as failure.

OPEN-021 EFS enforcement, protected device identity initialization, fatal startup evidence, PR-172 and historical source immutability are retained. No `NOT_RUN` result is classified as `PASS`.
