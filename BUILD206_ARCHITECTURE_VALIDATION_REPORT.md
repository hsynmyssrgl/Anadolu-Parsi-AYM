# Build 206 Mimari ve Yönetişim Doğrulama Raporu

## Kapsam

Build 206, proje anayasasını Ana Build Defteri içine taşıyan ve build başlangıcını güncel kural hash kabulüne bağlayan yönetişim değişikliğidir.

## Mimari kararlar

1. Ana Build Defteri hem devam noktası hem bağlayıcı proje kuralları için tek kullanıcı-okunabilir kaynak haline getirildi.
2. Makine kaynağında kural sürüm geçmişi saklanır; gelecekte kural değişikliği eski sürümü silmez.
3. Her build, yürürlükte olan kural sürümünün `version + sha256 + acknowledgedAt` bilgisini kaydeder.
4. Build başlatma yolları fail-closed çalışır; hash yoksa veya uyuşmuyorsa sürüm/build değişimi uygulanmaz.
5. Source preflight içinde Build 206 proje kural sözleşmesi aktif zorunlu kapıdır.

## Gerçekten çalıştırılan doğrulamalar

- `verify-build206-project-rules-contract.mjs`: **PASS — 132 assertion / 105 kural**
- `verify-master-build-ledger.mjs` ilk hedefli kontrol: **PASS**
- `update-master-build-ledger start` eksik `--rules-ack`: **REJECTED**
- `update-master-build-ledger start` yanlış hash: **REJECTED**
- Node syntax kontrolleri: **PASS**

## Sınır

Tam dependency install, root TypeScript, tüm testler, production build, smoke ve gerçek Windows installer bu yönetişim buildinde çalıştırılmamıştır; PASS olarak gösterilmez.
