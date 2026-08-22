# DEC-267 — Geçişli sesli kurulum, tek pars ve kasa kilidi düzeltmesi

- Tarih: 22.08.2026
- Durum: ACTIVE
- Yürürlük: Bronze 22.08.2026.46
- Değiştirdiği karar: DEC-266
- Kanonik kural: PR-233

## Kullanıcı kararı

Kurulum karşılama ekranı ilk kullanıcı/aile oluşturma yüzeyiyle aynı sakin görsel dili kullanacak ve gerçek bilgi adımları arasında geçiş yapacaktır. Geçiş sahte kurulum ilerlemesi değildir; gerçek dosya kurulumu yalnız NSIS yerel ilerleme sayfasında gösterilir. Kurulum tanıtımı Türkçe ve İngilizcede sistem diliyle seslendirilir; aynı dilde kadın sesi öncelikli, bulunamazsa aynı dilde erkek veya kurulu ilk ses yedektir. Görünür metin her zaman asıl kaynaktır.

İlk aile ekranındaki üçlü pars kompozisyonu kaldırılır ve önceki tek pars marka görseli geri getirilir. Yüzey 900x640 görünümde yatay taşmadan ve hareket azaltma tercihiyle çalışmaya devam eder.

İlk aile oluşturulduktan sonra iki aşamalı doğrulama başlatılırken görülen `Kullanıcı veri kasası kilitli` hatası giderilir. Oturum kilidi, yeniden doğrulama için gerekli açık veri kasası oturumunu yok edemez; kilitli yüzey güvenli yeniden doğrulama yolunu korur.

## Uygulama sınırı

- Eski Bronze 22.08.2026.45 installer EXE, blockmap ve SHA-256 dosyaları yeni kaynak değişikliğinden önce silinir.
- Bu düzeltme turunda yeni installer üretilmez; önce kaynak, hedefli test, typecheck ve görsel kanıt tamamlanır.
- Gerçek kurulum sesi, temiz Windows kurulum yaşam döngüsü ve production Authenticode kanıtı çalıştırılmadıkça PASS sayılamaz.
- Kişisel kullanıcı verisi test girdisi veya kanıt olarak kullanılmaz.

## Kabul kapıları

1. `scripts/verify-first-family-clean-release-policy.mjs`
2. `apps/desktop/scripts/verify-installer.mjs`
3. `apps/desktop/tests/installer-narration-experience.test.ts`
4. `apps/desktop/tests/first-family-production-composition.test.ts`
5. `apps/desktop/tests/ilk-acilis-deneyimi.test.ts`
6. Desktop typecheck ve 900x640 / 1560x960 görsel yakalama

Bu karar `PR-233` ile fail-closed uygulanır; `PR-232` tarihsel kayıt olarak `SUPERSEDED` durumundadır.
