# Build 207 Mimari ve Yönetişim Doğrulama Raporu

## Kapsam

Build 207, sohbet bağlam kapasitesini build yaşam döngüsünün zorunlu parçası yapan ve %90 tahmini kullanımda aynı sohbet içinde yeni build başlatılmasını engelleyen yönetişim değişikliğidir.

## Bağlayıcı kararlar

- DEC-097
- ADR-080
- `PPT-BUILD-LEDGER-CONTINUITY-V3`
- `PROJECT-RULES-2026-08-01-V2`
- PR-106…PR-111

## Mimari sonuç

1. Tamamlanan her Build 207+ kaydı `conversationCapacityAssessment` taşır.
2. Ölçüm `assistant_estimate` niteliğindedir; kesin platform/token sayacı olduğu iddia edilmez.
3. %85–89 `WARNING`, %90+ `HARD_STOP` olarak sabittir.
4. Standart build başlangıcı ve workspace sürüm yükseltme yolu önceki build %90+ ise fail-closed reddeder.
5. HARD_STOP durumunda yeni-sohbet devir promptu zorunlu üretilir.
6. Ana Build Defteri kural seti, kapasite durumu, devam noktası ve build geçmişi için tek yetkili kaynaktır.

## Gerçekten çalıştırılan kontroller

- Build 207 sohbet bağlam/devir sözleşmesi: **PASS — 29/29**
- Master Build Ledger: **PASS — 207/207 COMPLETED**
- %90 standart build-start negatif testi: **PASS — REJECTED**
- %90 workspace-version negatif testi: **PASS — REJECTED**
- İlk kaynak manifest/bütünlük kontrolü: **PASS — 1809/1809 kaynak**

## Doğrulama sınırı

Tam temiz bağımlılık kurulumu, tüm workspace TypeScript, tüm testler, Electron production build, blocking smoke ve gerçek Windows installer bu yönetişim buildinin hedefli kapsamı değildir ve çalıştırılmadıkça `NOT_RUN` kalır.
