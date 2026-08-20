import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { copyFile, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const root = resolve(import.meta.dirname, '../../..');
const cacheRoot = resolve(root, 'artifacts/validation/electron-cache');
const windowsPackagerRoot = resolve(root, 'tools/windows-packager');
const builderCli = resolve(root, 'tools/windows-packager/node_modules/electron-builder/cli.js');
const directoryMode = ['--win', 'dir', '--config.forceCodeSigning=false'];
const signedInstallerMode = ['--win', 'nsis'];
const isDirectoryMode = process.argv.includes('--dir');
const isLocalUnsignedMode = process.argv.includes('--local-unsigned');
if (isDirectoryMode && isLocalUnsignedMode) {
  console.error('Directory-only and local unsigned NSIS modes cannot be selected together.');
  process.exit(1);
}
if (!existsSync(builderCli)) {
  console.error('Windows paketleme bağımlılıkları kurulmamış. Önce kökte `npm run windows-packager:install` komutunu çalıştırın.');
  process.exit(1);
}
mkdirSync(cacheRoot, { recursive: true });

const desktopPackage = JSON.parse(await readFile(resolve(root, 'apps/desktop/package.json'), 'utf8'));
const releaseArtifactTemplate = desktopPackage.build?.win?.artifactName ?? desktopPackage.build?.artifactName;
if (typeof releaseArtifactTemplate !== 'string') {
  console.error('Windows artifact template is missing.');
  process.exit(1);
}
// The governed public filename is intentionally identical in signed and local
// build modes. Trust classification comes from Authenticode/evidence, never
// from a filename suffix that can be forged or become stale.
const localUnsignedArtifactTemplate = releaseArtifactTemplate;
const localUnsignedMode = [
  '--win',
  'nsis',
  '--config.forceCodeSigning=false',
  `--config.artifactName=${localUnsignedArtifactTemplate}`,
  `--config.win.artifactName=${localUnsignedArtifactTemplate}`
];
const packageMode = isDirectoryMode
  ? directoryMode
  : isLocalUnsignedMode
    ? localUnsignedMode
    : signedInstallerMode;

let temporaryTemplateRoot;
let childArgs = [builderCli, ...packageMode];
if (!isDirectoryMode) {
  const packagerPackage = JSON.parse(await readFile(resolve(windowsPackagerRoot, 'package.json'), 'utf8'));
  if (packagerPackage.devDependencies?.['electron-builder'] !== '26.15.6') {
    console.error('Real-progress NSIS template override supports only the reviewed electron-builder 26.15.6 toolchain.');
    process.exit(1);
  }
  const upstreamTemplateRoot = resolve(windowsPackagerRoot, 'node_modules/app-builder-lib/templates/nsis');
  const upstreamExtractorPath = resolve(upstreamTemplateRoot, 'include/extractAppPackage.nsh');
  const governedExtractorPath = resolve(root, 'apps/desktop/build/extractAppPackage.nsh');
  const [upstreamExtractor, governedExtractor] = await Promise.all([
    readFile(upstreamExtractorPath, 'utf8'),
    readFile(governedExtractorPath, 'utf8')
  ]);
  if ((upstreamExtractor.match(/Nsis7z::Extract "\$\{FILE\}"/gu) ?? []).length !== 2
    || upstreamExtractor.includes('AymInstallPayloadStageBegin')
    || !upstreamExtractor.includes('!macro extractEmbeddedAppPackage')) {
    console.error('The installed electron-builder NSIS extraction template drifted from the reviewed 26.15.6 shape.');
    process.exit(1);
  }
  if ((governedExtractor.match(/Nsis7z::ExtractWithDetails/gu) ?? []).length !== 2
    || (governedExtractor.match(/Call AymInstallPayloadStageBegin/gu) ?? []).length !== 3
    || (governedExtractor.match(/Call AymInstallPayloadStageEnd/gu) ?? []).length !== 3) {
    console.error('The governed single-progress NSIS extraction template is incomplete.');
    process.exit(1);
  }
  temporaryTemplateRoot = await mkdtemp(join(tmpdir(), 'parsyuva-nsis-template-'));
  const temporaryNsisRoot = resolve(temporaryTemplateRoot, 'nsis');
  await cp(upstreamTemplateRoot, temporaryNsisRoot, { recursive: true, force: false, errorOnExist: true });
  await copyFile(governedExtractorPath, resolve(temporaryNsisRoot, 'include/extractAppPackage.nsh'));

  // Load electron-builder in a fresh child process, replace only its exported
  // template root, then run the normal CLI. No dependency file is modified.
  const nsisUtilPath = resolve(windowsPackagerRoot, 'node_modules/app-builder-lib/out/targets/nsis/nsisUtil.js');
  const templateBootstrap = [
    "const path = require('node:path');",
    'const [builderCli, nsisUtilPath, expectedRoot, governedRoot, ...builderArgs] = process.argv.slice(1);',
    'const nsisUtil = require(nsisUtilPath);',
    "if (path.resolve(nsisUtil.nsisTemplatesDir) !== path.resolve(expectedRoot)) throw new Error('electron-builder NSIS template root drifted');",
    'nsisUtil.nsisTemplatesDir = governedRoot;',
    'process.argv = [process.execPath, builderCli, ...builderArgs];',
    'require(builderCli);'
  ].join('');
  childArgs = ['-e', templateBootstrap, builderCli, nsisUtilPath, upstreamTemplateRoot, temporaryNsisRoot, ...packageMode];
}

try {
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(process.execPath, childArgs, {
      cwd: resolve(root, 'apps/desktop'),
      env: {
        ...process.env,
        ELECTRON_CACHE: cacheRoot,
        electron_config_cache: cacheRoot
      },
      shell: false,
      windowsHide: true,
      stdio: 'inherit'
    });
    child.on('error', (error) => {
      console.error(`Electron builder could not start: ${error.message}`);
      resolveExit(1);
    });
    child.on('close', (code, signal) => {
      if (signal) {
        console.error(`Electron builder was terminated by signal ${signal}.`);
        resolveExit(1);
        return;
      }
      resolveExit(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} finally {
  if (temporaryTemplateRoot) {
    await rm(temporaryTemplateRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  // electron-builder adds a UTF-8 BOM to localized RTF inputs while compiling.
  // Restore the governed ASCII source form so packaging never dirties the tree.
  const licenseSource = await readFile(resolve(root, 'apps/desktop/docs/LISANS_TR_KAYNAK.txt'), 'utf8');
  await writeFile(
    resolve(root, 'apps/desktop/build/LICENSE_TR.rtf'),
    renderLicenseRtf(licenseSource),
    'ascii'
  );
}
