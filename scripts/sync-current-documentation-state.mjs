import { readFile, readdir, writeFile } from 'node:fs/promises';

const roadmapPath = 'config/remaining-scope-package-roadmap.json';
const roadmap = JSON.parse(await readFile(roadmapPath, 'utf8'));
const configFiles = await readdir('config');
const scopeByStep = new Map();

for (const name of configFiles.filter((value) => /^(33-[m-z]|34-[a-l])-.*-scope\.json$/i.test(value))) {
  const value = JSON.parse(await readFile(`config/${name}`, 'utf8'));
  const step = value.step ?? name.slice(0, 4).toUpperCase();
  scopeByStep.set(step.toUpperCase(), value);
}

const openReasons = {
  '33-P': 'Gerçek passkey/authenticator, canlı ve güvenilen federated kimlik sağlayıcısı, cross-device doğrulama, insan UAT ile gizlilik/kimlik incelemeleri tamamlanmadı.',
  '33-Q': 'Varsayılan malware/PDF sağlayıcısı, düşük-yetkili worker izolasyonu, çalışan işi eşzamanlı iptal, kaynak silme crash auto-resume, zamanlanmış orphan/retention sweep ve gerçek Windows UAT tamamlanmadı.',
  '33-R': 'Gerçek büyük arşiv, medya yaşam döngüsü, arama doğruluğu/performansı ve kullanıcı UAT kanıtları tamamlanmadı.',
  '33-S': 'Gerçek sağlık/bakım sağlayıcıları, cihaz akışları, klinik doğruluk ve hukuk-gizlilik incelemesi tamamlanmadı.',
  '33-T': 'Gerçek hane verisi, uzun süreli görev/teslimat akışı ve farklı kullanıcı profilleriyle UAT tamamlanmadı.',
  '33-U': 'Çocuk/veli mahremiyeti, okul/servis sağlayıcısı, yaşa uygun açıklama ve hukuk-gizlilik/UAT kanıtı tamamlanmadı.',
  '33-V': 'Gerçek harita, seyahat, araç/evcil hayvan sağlayıcıları, çevrimdışı saha akışı ve UAT tamamlanmadı.',
  '33-W': 'Gerçek AI sağlayıcısı, model/veri sözleşmesi, maliyet-mahremiyet sınırı, güvenlik değerlendirmesi ve insan UAT tamamlanmadı.',
  '33-X': 'Gerçek ses/transkript, yüz gruplama, basılı çıktı, zaman kapsülü rıza akışı ve insan UAT tamamlanmadı.',
  '33-Y': 'Gerçek Matter/enerji cihazları, üretici adaptörleri, güvenlik/safety değerlendirmesi ve saha UAT tamamlanmadı.',
  '33-Z': 'Üretim kod imzalama sertifikası, gerçek eklenti sağlayıcıları, dağıtım/rollback ve güven zinciri kanıtı tamamlanmadı.',
  '34-A': 'Gerçek MLS sağlayıcısı, çoklu istemci birlikte çalışabilirliği, cihaz kimliği ve haricî güvenlik incelemesi tamamlanmadı.',
  '34-B': 'Gerçek çoklu istemci mesaj teslimi, presence, çevrimdışı/replay ve uzun süreli yaşam döngüsü UAT tamamlanmadı.',
  '34-C': 'Gerçek WebRTC/SFU/TURN, kamera-mikrofon cihazları, ağ bozulması ve erişilebilir çağrı UAT tamamlanmadı.',
  '34-D': 'Kayıt için gerçek katılımcı rızası, medya saklama/imha, hukuk-gizlilik incelemesi ve cihaz UAT tamamlanmadı.',
  '34-E': 'Gerçek çeviri/altyazı sağlayıcısı, dil kalite ölçümü, cihaz performansı ve insan UAT tamamlanmadı.',
  '34-F': 'Gerçek aile toplantısı, karar/rıza uyuşmazlığı, tutanak UAT ve hukuk-gizlilik incelemesi tamamlanmadı.',
  '34-G': 'Gerçek çoklu cihaz E2EE dosya aktarımı, büyük dosya/kesinti, sağlayıcı ve kullanıcı UAT tamamlanmadı.',
  '34-H': 'Gerçek uzun süreli iletişim audit/arşiv bütünlüğü, saklama/imha ve bağımsız inceleme tamamlanmadı.',
  '34-I': 'Gerçek çoklu node quorum/witness/failover, mTLS kimliği, ağ bölünmesi ve uzun süreli soak tamamlanmadı.',
  '34-J': 'Gerçek dağıtık istemciler, Apple companion, operasyon/felaket kurtarma ve saha provası tamamlanmadı.',
  '34-K': 'Animasyonlu kurulum, sesli Yardım Merkezi, DPAPI korumalı Core Service companion ve gerçek repository-backed anlık evrensel arama yerel kaynakta oluşturulup hedef testlerle doğrulandı. Production Authenticode sertifikası sağlanmadı; temiz işletim sistemi, signed installer, upgrade/repair/yeni uninstall-veri koruma, yeniden başlatma/güç kesintisi, 168 saat soak, üretim politika-zayıflatma doğrulayıcısı ve erişilebilirlik UAT tamamlanmadı.',
  '34-L': 'Bütün roadmap paketleri kabul edilmedi; gerçek Windows/dağıtık/Apple/uzak sağlayıcı/soak/sertifikasyon ve dış incelemeler NOT_RUN kaldı.'
};

const closedReasons = {
  '33-M': 'Kapalı: erişilebilirlik tercih merkezi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı.',
  '33-N': 'Kapalı: taslak ve asenkron durum UX paketi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı.',
  '33-O': 'Kapalı: gizlilik, sahiplik, veri hakları ve yerel olay kontrol paketi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı.'
};

for (const item of roadmap.packages) {
  const step = String(item.step).toUpperCase();
  const scope = scopeByStep.get(step);
  if (!scope) continue;
  const manualNotRun = Object.entries(scope.manualEvidence ?? {})
    .filter(([, value]) => value === 'NOT_RUN')
    .map(([key]) => key);
  item.governancePhase = scope.governancePhase ?? scope.governanceState ?? null;
  item.localImplementationStatus = scope.localImplementationStatus ?? scope.localImplementationChain?.status ?? scope.plannedModel?.implementationStatus ?? (item.status === 'COMPLETED' ? 'ACCEPTED_COMPLETED_WITH_PERSISTENT_RECEIPT' : 'LOCAL_IMPLEMENTATION_PRESENT_ACCEPTANCE_INCOMPLETE');
  item.countsAsRequirementPass = item.status === 'COMPLETED' || scope.truth?.countsAsRequirementPass === true;
  item.openReason = item.status === 'COMPLETED' ? null : openReasons[step];
  item.closureReason = item.status === 'COMPLETED' ? closedReasons[step] : null;
  item.missingEvidence = item.status === 'COMPLETED' ? [] : manualNotRun;
  item.currentStatusSource = configFiles.find((name) => name.toUpperCase().startsWith(`${step}-`) && name.endsWith('-scope.json')) ?? null;
}

roadmap.updatedAt = '2026-08-18T03:30:00+03:00';
roadmap.documentationStatusRule = {
  requiredForEveryOpenPackage: ['status', 'localImplementationStatus', 'openReason', 'missingEvidence', 'countsAsRequirementPass'],
  requiredForEveryClosedPackage: ['status', 'localImplementationStatus', 'closureReason', 'missingEvidence', 'countsAsRequirementPass'],
  rule: 'Açık kalan her iş; neyin yerel olarak tamamlandığını, neden açık kaldığını ve hangi kanıtın eksik olduğunu göstermelidir. PARTIAL, BLOCKED ve NOT_RUN tamamlandı sayılamaz.',
  decision: 'DEC-251'
};

await writeFile(roadmapPath, `${JSON.stringify(roadmap, null, 2)}\n`);
console.log(`Current documentation state synchronized for ${roadmap.packages.filter((item) => item.openReason).length} open packages.`);
