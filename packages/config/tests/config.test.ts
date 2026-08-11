
import { describe, expect, it } from 'vitest';
import { createDefaultConfig, redactConfig, validateConfig } from '../src/index.js';

const paths = {
  data: 'C:/PPT/data',
  archive: 'C:/PPT/archive',
  cache: 'C:/PPT/cache',
  logs: 'C:/PPT/logs',
  temp: 'C:/PPT/temp',
  secrets: 'C:/PPT/secrets'
};

describe('@ppt/config', () => {
  it('güvenli Bronze varsayılanlarını üretir', () => {
    const config = createDefaultConfig({ version: '23.07.2026.43', environment: 'development', paths });
    expect(config.app.channel).toBe('bronze');
    expect(config.database.journalMode).toBe('WAL');
    expect(config.backup.minimumVerifiedCopies).toBe(1);
    expect(validateConfig(config).ok).toBe(true);
  });

  it('çakışan uygulama veri yollarını reddeder', () => {
    const config = createDefaultConfig({
      version: '23.07.2026.43',
      environment: 'test',
      paths: { ...paths, cache: paths.data }
    });
    expect(validateConfig(config).ok).toBe(false);
  });

  it('loglanacak configuration görünümünde gerçek yolları gizler', () => {
    const config = createDefaultConfig({ version: '23.07.2026.43', environment: 'production', paths });
    expect(redactConfig(config).paths).toEqual({
      data: '<configured>', archive: '<configured>', cache: '<configured>', logs: '<configured>', temp: '<configured>', secrets: '<configured>'
    });
  });
});
