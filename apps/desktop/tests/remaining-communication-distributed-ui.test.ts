import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
describe('34-G/H/I/J fail-honest renderer surfaces',()=>{it('exposes local controls without claiming unavailable providers',()=>{
  const sources=['CommunicationFileSharingPanel.tsx','CommunicationAuditArchivePanel.tsx','DistributedOperationsPanel.tsx']
    .map(file=>readFileSync(`apps/desktop/src/renderer/${file}`,'utf8')).join('\n');
  for(const marker of ['Üretim dosya aktarımı ve yerel zararlı dosya tarayıcısı yapılandırılmamıştır','Acil servis garantisi değildir',
    'Audit olayları mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz','production composition bağlı değil',
    'Olgun Raft, mTLS sertifika otoritesi, mDNS, relay, Windows Service Host ve Apple istemcileri yapılandırılmamıştır',
    'özel consensus algoritması yazılmamıştır','gerçek Windows node matrisi `NOT_RUN` kalır'])expect(sources).toContain(marker);
  expect(sources).toContain('disabled');});});
