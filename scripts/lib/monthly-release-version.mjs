const RELEASE_CHANNELS = new Set(['Bronze', 'Silver', 'Gold']);

const istanbulDateParts = (now) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('Europe/Istanbul derleme tarihi çözümlenemedi.');
  return { year, month, day };
};

export const createNextMonthlyRelease = ({ ledger, now = new Date(), channel = ledger.current?.channel }) => {
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.entries)) {
    throw new Error('Sürüm defteri şeması geçersiz.');
  }
  if (!RELEASE_CHANNELS.has(channel)) throw new Error(`Desteklenmeyen sürüm kanalı: ${String(channel)}`);
  const { year, month, day } = istanbulDateParts(now);
  const isoDate = `${year}-${month}-${day}`;
  const displayDate = `${day}.${month}.${year}`;
  const monthPrefix = `${year}-${month}-`;
  const monthSequences = ledger.entries
    .filter((entry) => typeof entry.date === 'string' && entry.date.startsWith(monthPrefix))
    .map((entry) => entry.monthlySequence)
    .filter((value) => Number.isInteger(value) && value > 0);
  const monthlySequence = (monthSequences.length > 0 ? Math.max(...monthSequences) : 0) + 1;
  const packageDate = `${Number(day)}.${Number(month)}.${year}`;
  const packageVersion = `${packageDate}-${monthlySequence}`;
  const version = `${displayDate}.${monthlySequence}`;
  const channelSlug = channel.toLocaleLowerCase('en-US');
  return Object.freeze({
    channel,
    date: isoDate,
    displayDate,
    monthlySequence,
    version,
    visibleRelease: `${channel} ${version}`,
    packageVersion,
    releaseId: `${channelSlug}-${isoDate}-r${monthlySequence}`,
    status: 'IN_PROGRESS',
    parentRelease: ledger.current?.visibleRelease ?? null,
    summary: 'Resmî derleme numarası yalnız paketleme yetkisi tarafından ayrıldı.'
  });
};

export const installerArtifactTemplate = (release) =>
  `ParsYuva-${release.channel}-${release.version}.\${ext}`;

export const installerFileName = (release, _arch = 'x64', extension = 'exe') =>
  `ParsYuva-${release.channel}-${release.version}.${extension}`;

export const assertExpectedReleaseId = (release, expectedReleaseId) => {
  if (typeof expectedReleaseId !== 'string' || expectedReleaseId.trim() === '') {
    throw new Error('Sürüm tahsisi için --expected-release-id zorunludur.');
  }
  if (release.releaseId !== expectedReleaseId) {
    throw new Error(`Beklenen sürüm kimliği uyuşmuyor: beklenen=${expectedReleaseId}; hesaplanan=${release.releaseId}.`);
  }
  return release;
};

export const assertPreallocatedReleaseIdentity = ({
  expectedReleaseId,
  ledger,
  rootManifest,
  desktopManifest,
  repositoryMetadata,
  appMeta
}) => {
  const current = ledger?.current;
  if (!current || typeof current !== 'object') throw new Error('Önceden tahsis edilmiş güncel sürüm kaydı eksik.');
  if (typeof expectedReleaseId !== 'string' || expectedReleaseId.trim() === '') {
    throw new Error('Paketleme için beklenen release ID zorunludur.');
  }
  if (current.releaseId !== expectedReleaseId) {
    throw new Error(`Paketleme release ID uyuşmazlığı: beklenen=${expectedReleaseId}; güncel=${String(current.releaseId)}.`);
  }
  const matchingEntries = ledger.entries?.filter((entry) =>
    entry.releaseId === current.releaseId
    && entry.version === current.version
    && entry.packageVersion === current.packageVersion
    && entry.monthlySequence === current.monthlySequence
  ) ?? [];
  if (matchingEntries.length !== 1) throw new Error('Güncel sürüm kaydı kanonik sürüm geçmişine exact tekil bağlı değil.');
  if (typeof current.status !== 'string' || current.status.trim() === '' || matchingEntries[0].status !== current.status) {
    throw new Error('Güncel sürüm lifecycle durumu kanonik current/entry arasında exact eşleşmiyor.');
  }
  if (typeof current.parentRelease !== 'string' || current.parentRelease.trim() === ''
    || matchingEntries[0].parentRelease !== current.parentRelease) {
    throw new Error('Güncel sürüm parentRelease değeri kanonik current/entry arasında exact eşleşmiyor.');
  }
  if (current.releaseId === 'bronze-2026-08-26-r51'
    && (current.status !== 'IN_PROGRESS' || current.status.startsWith('REJECTED'))) {
    throw new Error('Bronze sequence-51 recovery lifecycle durumu paketleme için izinli değildir.');
  }
  if (rootManifest?.version !== current.packageVersion) throw new Error('Kök paket sürümü güncel tahsisle uyuşmuyor.');
  if (desktopManifest?.version !== current.packageVersion) throw new Error('Desktop paket sürümü güncel tahsisle uyuşmuyor.');
  const artifactTemplate = `ParsYuva-${current.channel}-${current.version}.\${ext}`;
  if (desktopManifest?.build?.artifactName !== artifactTemplate
    || desktopManifest?.build?.win?.artifactName !== artifactTemplate) {
    throw new Error('Windows installer adı güncel tahsisle uyuşmuyor.');
  }
  if (repositoryMetadata?.repositoryVersion !== current.version
    || repositoryMetadata?.applicationVersion !== current.version
    || repositoryMetadata?.visibleRelease !== current.visibleRelease
    || repositoryMetadata?.packageVersion !== current.packageVersion
    || repositoryMetadata?.releaseId !== current.releaseId) {
    throw new Error('Repository metadata güncel tahsisle uyuşmuyor.');
  }
  for (const marker of [
    `version: '${current.version}'`,
    `packageVersion: '${current.packageVersion}'`,
    `releaseLabel: '${current.visibleRelease}'`,
    `releaseId: '${current.releaseId}'`,
    `monthlySequence: ${current.monthlySequence}`
  ]) {
    if (!appMeta?.includes(marker)) throw new Error(`APP_META güncel tahsis işareti eksik: ${marker}`);
  }
  return Object.freeze({ ...current });
};
