import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OFFLINE_FAMILY_MAP_RELATIVE_PATH,
  OFFLINE_FAMILY_MAP_URL,
  respondToOfflineFamilyMapRequest
} from '../src/main/offline-family-map-protocol.js';

const temporaryRoots: string[] = [];

function createPackage(): { root: string; filePath: string; bytes: Buffer } {
  const root = mkdtempSync(join(tmpdir(), 'parsyuva-offline-map-'));
  temporaryRoots.push(root);
  const filePath = join(root, OFFLINE_FAMILY_MAP_RELATIVE_PATH);
  mkdirSync(join(root, 'haritalar'), { recursive: true });
  const bytes = Buffer.alloc(256, 0);
  bytes.write('PMTiles', 0, 'ascii');
  bytes[7] = 3;
  writeFileSync(filePath, bytes, { flag: 'wx' });
  return { root, filePath, bytes };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('çevrimdışı aile haritası', () => {
  it('kurulmamış isteğe bağlı paketi konsol 404 hatası üretmeden boş sonuçla bildirir', () => {
    const root = mkdtempSync(join(tmpdir(), 'parsyuva-offline-map-missing-'));
    temporaryRoots.push(root);
    expect(respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL, {
      headers: { range: 'bytes=0-127' }
    }), root)?.status).toBe(204);
  });

  it('yalnız sabit uygulama adresindeki geçerli PMTiles paketine kontrollü aralık erişimi verir', async () => {
    const { root, bytes } = createPackage();
    const response = respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL, {
      headers: { range: 'bytes=0-127' }
    }), root);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(206);
    expect(response?.headers.get('content-range')).toBe('bytes 0-127/256');
    expect(response?.headers.get('accept-ranges')).toBe('bytes');
    expect(response?.headers.get('content-type')).toBe('application/vnd.pmtiles');
    expect(Buffer.from(await response!.arrayBuffer())).toEqual(bytes.subarray(0, 128));

    const head = respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL, { method: 'HEAD' }), root);
    expect(head?.status).toBe(200);
    expect(head?.headers.get('content-length')).toBe('256');
  });

  it('eksik, değiştirilmiş, hard-linkli ve geçersiz aralık isteklerini kapalı reddeder', () => {
    const { root, filePath } = createPackage();
    expect(respondToOfflineFamilyMapRequest(new Request(`${OFFLINE_FAMILY_MAP_URL}?path=secret`), root)?.status).toBe(404);
    expect(respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL), root)?.status).toBe(416);
    expect(respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL, { headers: { range: 'bytes=0-1,4-5' } }), root)?.status).toBe(416);
    expect(respondToOfflineFamilyMapRequest(new Request('pardus-app://renderer/index.html'), root)).toBeNull();
    expect(respondToOfflineFamilyMapRequest(new Request('https://example.com/turkiye.pmtiles'), root)).toBeNull();

    linkSync(filePath, `${filePath}.hardlink`);
    expect(respondToOfflineFamilyMapRequest(new Request(OFFLINE_FAMILY_MAP_URL, { headers: { range: 'bytes=0-127' } }), root)?.status).toBe(404);
  });

  it('rendererı ağsız harita, güvenli geriye düşüş ve veri-minimizasyonu sözleşmesine bağlar', () => {
    const renderer = readFileSync('apps/desktop/src/renderer/FamilyLocationMap.tsx', 'utf8');
    const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    expect(renderer).toContain("const OFFLINE_MAP_URL = 'pardus-app://renderer/offline-map/turkiye.pmtiles'");
    expect(renderer).toContain('Çevrimdışı harita paketi bulunamadı');
    expect(renderer).toContain('Ağ ve bulut kullanılmadı');
    expect(renderer).toContain('© OpenStreetMap katkıda bulunanlar');
    expect(renderer).not.toMatch(/https?:\/\//u);
    expect(renderer).not.toMatch(/navigator\.geolocation|watchPosition|localStorage|sessionStorage/u);
    expect(app).toContain('<FamilyLocationMap locations={snapshot.locations} />');
    expect(main).toContain('respondToOfflineFamilyMapRequest(request, app.getPath(\'userData\'))');
  });
});
