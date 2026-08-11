import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspaceSource = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ppt/application': workspaceSource('./packages/application/src/index.ts'),
      '@ppt/config': workspaceSource('./packages/config/src/index.ts'),
      '@ppt/contracts': workspaceSource('./packages/contracts/src/index.ts'),
      '@ppt/core': workspaceSource('./packages/core/src/index.ts'),
      '@ppt/database': workspaceSource('./packages/database/src/index.ts'),
      '@ppt/domain': workspaceSource('./packages/domain/src/index.ts'),
      '@ppt/events': workspaceSource('./packages/events/src/index.ts'),
      '@ppt/infrastructure': workspaceSource('./packages/infrastructure/src/index.ts'),
      '@ppt/logging': workspaceSource('./packages/logging/src/index.ts'),
      '@ppt/platform-policy': workspaceSource('./packages/platform-policy/src/index.ts'),
      '@ppt/repositories': workspaceSource('./packages/repositories/src/index.ts'),
      '@ppt/repository-contracts': workspaceSource('./packages/repository-contracts/src/index.ts'),
      '@ppt/security': workspaceSource('./packages/security/src/index.ts'),
      '@ppt/test-data': workspaceSource('./packages/test-data/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/core-service/src/**/*.ts'],
      thresholds: {
        statements: 48,
        functions: 58,
        branches: 39,
        lines: 56,
        'apps/core-service/src/{protected-cutover-readiness-journal-port,signed-cutover-readiness-evidence-verifier,synthetic-single-writer-proof-harness,synthetic-key-lifecycle-proof-harness,synthetic-rollback-recovery-drill,end-to-end-security-evidence-aggregator,explicit-user-cutover-approval-receipt,versioned-cutover-decision-preflight}.ts': {
          statements: 90,
          functions: 90,
          branches: 90,
          lines: 90
        }
      }
    }
  }
});
