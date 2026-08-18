# Aktif Geliştirme Durumu

- Sürüm: **Bronze 04.08.2026.29**
- Kanal: **Bronze**
- Durum: **Aktif geliştirme / Silver engelli**
- Aylık sürüm sıra numarası: **29**
- Güncel yerel uygulama/kabul ayrımı: `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- 34-L yerel kapanış otomasyonu PASS olsa da dış/manuel kanıtlar `NOT_RUN`; Silver engeli ve `countsAsRequirementPass=false` korunur.
- Ana kapsam: `docs/current/00_AKTIF_ANA_KAPSAM.md`
- Gereksinim sicili: `config/accepted-scope-registry.json`

Bu sürümde kapsam birleştirme, Platform Policy Kernel, Core Service süreç sınırı ve dürüst Feature Reality kapısı başlatılmıştır. Çalıştırılmayan hiçbir kontrol PASS değildir.

17.08.2026 güncel teknik kanıtında Core Service companion ve korumalı CurrentUser DPAPI provisioning uygulanmış; root typecheck/build ile 292 dosya/1.986 test ve paketlenmiş uygulamanın iki ardışık normal açılışı PASS olmuştur. Eski `C:\\Program Files\\@pptdesktop` kopyası kaldırılmış, güncel imzasız yerel paket `C:\\Program Files\\PPT\\AYM` altına kurulmuş; ana pencere, renderer ve Core Service utility süreciyle kurulu açılış PASS vermiştir. Production Authenticode sertifikası sağlanmadığı için çalıştırılabilir dosya `NotSigned` durumundadır ve signed-only installer üretimi açık kalır. Temiz işletim sistemi/upgrade/repair/yeni uninstall-veri koruma kanıtı olmadan dağıtım kabulü verilmez.
