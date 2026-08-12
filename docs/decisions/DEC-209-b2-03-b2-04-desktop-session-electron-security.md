# DEC-209 — B2-03/B2-04 masaüstü oturum ve Electron güvenliği

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B2-03, B2-04
- Uygulama paketi: 32-X

## Karar

Masaüstü oturumu varsayılan 15 dakika gerçek kullanıcı etkinliği görülmediğinde
kilitlenir. Son 60 saniyede erişilebilir bir uyarı gösterilir. Yalnız
`pointerdown`, `keydown` ve `touchstart` sinyalleri açık bir IPC çağrısıyla süreyi
uzatır; zamanlayıcılar, veri yenilemeleri, yedekleme ve diğer arka plan işleri
oturumu canlı tutamaz.

Kilit, React ağacını veya açık form/modalları unmount etmez. Uygulama yüzeyi
`aria-hidden` yapılır ve odak kapanlı `alertdialog` üst katmanı gösterilir. Kilitli
hesap kimliği yalnız main-process belleğinde tutulur; açma işlemi aynı hesap için
parolayı ve hesapta etkinse TOTP kodunu mevcut login use-case'i üzerinden yeniden
doğrular. Boşta kalma, manuel kilit ve başarılı açma mevcut audit repository'sine
yazılır.

Production renderer `file://` yerine yalnız `pardus-app://renderer` özel
protokolünden yüklenir. Protokol çözümleyici host, credentials, bozuk kodlama ve
kök dışı yol denemelerini reddeder. CSP response header ile uygulanır; sandbox,
context isolation, Node kapatma, web security, permission/download/navigation/
redirect/webview/new-window retleri korunur.

Electron 43.2.0 ikilisinin dokuz fuse'u `@electron/fuses 2.1.3` ile
`strictlyRequireAllFuses: true` altında afterPack aşamasında yazılır ve hemen
yeniden okunur. İlk gerçek ikili denemesinde eski 1.8.0 aracının dokuzuncu
`WasmTrapHandlers` fuse'unu bilmemesi fail-closed yakalanmış; araç yükseltilmiş ve
dokuz fuse'un tamamı geçici resmi Electron ikilisinde 9/9 doğrulanmıştır. Fuse
değişikliği kod imzalamadan önce yapılır.

## Veri ve migration sınırı

Yeni kullanıcı tablosu veya session repository'si yoktur. İçeriksiz domain
görünümleri, mevcut hesap/audit repository'leri ve bellek içi oturum yöneticisi
kullanılır. Yeni migration, backfill, veri taşıma veya cutover yapılmaz; latest
migration 77 kalır.

## Kapanış sınırı

B2-03 ve B2-04 birlikte tamamlanır. Fiziksel WebAuthn/FIDO2 donanım kabulü
B2-02'de; production code-signing sertifikası ve release eligibility PPK-025'te
açık kalır. B9-01, Silver readiness ve Bronze Final bu kararla tamamlanmaz.
