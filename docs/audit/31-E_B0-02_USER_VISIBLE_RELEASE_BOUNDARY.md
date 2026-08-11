# 31-E / B0-02 User-visible release boundary audit

Status: LOCAL PASS — awaiting persistent D: Library receipt.

The public application-info DTO contains only `name`, `releaseLabel`, `channel`, and `stage`. Internal identifiers such as `version`, `packageVersion`, `releaseId`, and `monthlySequence` remain available to internal manifests and diagnostics but are not returned by `app:getInfo` or exported through the renderer boundary.

The UI displays the canonical `Bronze 04.08.2026.29` label. User-facing delivery reports use `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json`; `RC`, `RC2`, `MVP`, and `Build` tokens fail closed. Historical evidence is not rewritten and no new Build is issued.

Validated gates: 31/31 contract checks, root TypeScript with zero diagnostics, 6/6 targeted tests, 169/169 full regression tests, and production builds for package workspaces, Electron main/preload, and renderer.
