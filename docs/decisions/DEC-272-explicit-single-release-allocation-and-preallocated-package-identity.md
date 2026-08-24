# DEC-272 — Açık tek seferli sürüm tahsisi ve önceden tahsisli paket kimliği

- Tarih: 24.08.2026
- Durum: ACTIVE
- Bağlayıcı kural: PR-237

## Karar

Resmî aylık sürüm tahsisi paketleme girişlerinin gizli yan etkisi değildir. Tahsis yalnız ayrı ve açık mutasyon komutuyla, zorunlu `--expected-release-id` bağıyla bir kez yapılır. Hesaplanan release ID beklenen kimlikle uyuşmazsa lock, geçici dosya, kaynak yazımı veya installer temizliği başlamadan işlem fail-closed durur. `--preview` yalnız çıktı üretir; dosya veya lock oluşturmaz.

Signed, yerel imzasız NSIS ve dizin paketleme girişleri allocator çağıramaz. Bu girişler yalnız önceden tahsis edilmiş `config/release-ledger.json`, kök/desktop manifestleri, `repository-metadata.json` ve `APP_META` exact kimliğini tüketir. Signed girişte beklenen release ID zorunludur ve kimlik doğrulaması installer temizliğinden önce tamamlanır.

Tahsis sırasında aktif kök belgeler, aktif current belgeler, güncel sürüm taşıyan config kayıtları ve ticari üst kayıt tek atomik yazım planında senkronize edilir. Tarihsel UAT, evidence, sürüm isimli teslim kaydı ve sentetik test fixture'ları değiştirilmez. Aynı beklenen kimlikle ikinci tahsis denemesi bir sonraki sıra kimliğini hesapladığı anda hiçbir dosyayı değiştirmeden reddedilir.

## Kabul sınırı

- Gerçek `24.08.2026.51` tahsisi bu kararın kodlama turunda yapılmaz.
- Preview lock veya makbuz oluşturamaz.
- Signed/local/dir girişleri aynı önceden tahsisli kimliği kullanır.
- Tahsis sonrası active-version sweep eski aktif markerı reddeder; tarihsel kanıtlara dokunmaz.
- Build, paketleme, kurulum ve production release bu kararın uygulanmış sayılması için otomatik olarak yapılmış sayılmaz.
