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
  `ParsYuva-AYM-${release.channel}-${release.version}-\${arch}-Kurulum.\${ext}`;

export const installerFileName = (release, arch = 'x64', extension = 'exe') =>
  `ParsYuva-AYM-${release.channel}-${release.version}-${arch}-Kurulum.${extension}`;
