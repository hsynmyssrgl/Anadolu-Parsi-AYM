import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const server = await createServer({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname
});
await server.listen();

const child = spawn(electron, ['dist/main/main.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PPT_RENDERER_URL: 'http://127.0.0.1:5173' }
});

const shutdown = async () => {
  if (!child.killed) child.kill();
  await server.close();
};

child.on('exit', async (code) => {
  await shutdown();
  process.exit(code ?? 0);
});
process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });
