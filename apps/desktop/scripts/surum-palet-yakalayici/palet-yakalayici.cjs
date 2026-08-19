const { app } = require('electron');

app.disableHardwareAcceleration();
import('./palet-yakalayici.mjs').catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  app.exit(1);
});
