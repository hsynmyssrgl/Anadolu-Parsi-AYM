const { app } = require('electron');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('mute-audio');
import('./yakalayici.mjs').catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  app.exit(1);
});
