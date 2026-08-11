# Release Notes — Bronze RC2 Build 106

## Added

- New `@ppt/repository-contracts` workspace package.
- 26 contract-only repository modules.
- Workspace source import versus manifest dependency verifier.
- Build 106 architecture verifier.

## Changed

- Repository-backed desktop adapters now consume `@ppt/repository-contracts`.
- SQLite repositories import and implement contract types from the dedicated package.
- Foundation build order now builds repository contracts before repository implementations.
- Root TypeScript path mapping includes the new contract workspace.

## Fixed

- Removed the implementation-bearing `@ppt/repositories/ports` public contract route.
- Added the missing direct `@ppt/domain` dependency to `@ppt/repositories`.
- Corrected 25 `RepositoryExecutionContext` imports discovered by targeted type analysis.

## Validation limitation

Clean dependency installation remains blocked by HTTP 503 for `esbuild-0.25.12.tgz`; downstream full validation gates remain `NOT_RUN`.
