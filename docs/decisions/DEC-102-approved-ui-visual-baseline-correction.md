# DEC-102 — Onaylı UI görsel baseline düzeltmesi

**Build:** 212  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

Build208–211 teslimlerinde aktif baseline olarak taşınan koyu dashboard görselinin, kullanıcının 01.08.2026 tarihinde Anadolu parsı logosu ve önceki font/renk kurallarıyla onayladığı açık-tema UI manifestosuyla uyuşmadığı tespit edildi. Tarihsel buildler değiştirilmeden Build212 ile aktif UI baseline `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png` olarak düzeltilir.

Onaylı görsel SHA-256: `f2f2a083fb74a50fc31459c8236eff9be74e01f9b359c5889fdb740395850357`.

Aktif manifest bu özeti sabitler; PNG ile makine-okunur tema/palet metadata'sı aynı açık-tema yönünü tarif eder ve farklı görselin aynı baseline adıyla taşınması fail-closed reddedilir. Görseldeki örnek metin/sayılar production seed veya kullanıcı verisi yetkisi vermez.

## Etkilenen alanlar

- `config/ui-visual-reference-manifest.json`
- `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO.md`
- `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png`
- `docs/13_UI_UX_ACCESSIBILITY_STANDARD.md`
- source preflight / teslim tasdik sözleşmesi
- Ana Build Defteri / Master dokümantasyon / Artifact Index

## Doğrulama

`scripts/verify-build212-ui-visual-baseline-provenance-contract.mjs` onaylı görseli dosya hash'i ile sabitler ve legacy yanlış aktif yolun artık bulunmadığını doğrular.
