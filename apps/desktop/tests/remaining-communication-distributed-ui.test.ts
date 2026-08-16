import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
describe('34-G/H/I/J fail-honest renderer surfaces',()=>{it('exposes local controls without claiming unavailable providers',()=>{
  const sources=['CommunicationFileSharingPanel.tsx','CommunicationAuditArchivePanel.tsx','DistributedOperationsPanel.tsx']
    .map(file=>readFileSync(`apps/desktop/src/renderer/${file}`,'utf8')).join('\n');
  for(const marker of ['Üretim dosya aktarımı ve zararlı dosya tarayıcısı yapılandırılmamıştır','acil servis değildir',
    'Audit olayları mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz','Üretim olay üretici kancaları henüz bağlı değildir.',
    'Olgun Raft, mTLS sertifika otoritesi, mDNS, relay, Windows Service Host ve Apple istemcileri yapılandırılmamıştır',
    'özel consensus algoritması yazılmamıştır','gerçek Windows node matrisi `NOT_RUN` kalır'])expect(sources).toContain(marker);
  expect(sources).toContain('Güvenli düz metin önizleme');
  expect(sources).toContain('<pre>{preview.text}</pre>');
  expect(sources).toContain('getCommunicationAuditArchiveCenter');
  expect(sources).toContain('disabled');});});
