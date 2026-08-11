# ADR-013 — İşletim Sistemi Korumalı Cihaz Kimliği Sırrı

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 128
- Karar: DEC-042

## Bağlam

Ed25519 cihaz kimliği, güvenilir cihaz doğrulamasının temelidir. Önceki dosya
biçimi özel anahtarı dosya izinleriyle korunan açık JSON içinde tutuyordu. POSIX
`0600` izni Windows üzerinde DPAPI seviyesinde sır koruması sağlamaz.

## Karar

Paketli uygulama ve Windows çalışma zamanı Electron `safeStorage` kullanır.
Windows üzerinde seçilen güvenli depolama arka ucu DPAPI'dir. Özel anahtar
şifrelenerek sürüm 2 cihaz kimliği zarfında saklanır; açık anahtar, parmak izi,
cihaz kimliği ve oluşturma zamanı doğrulama metadata'sı olarak açık kalabilir.

Legacy açık dosya atomik geçişle dönüştürülür. Geçiş sırasında kısa ömürlü geri
alma dosyası kullanılır; başarıdan sonra kaldırılır. Koruma zorunlu ve
kullanılamaz durumdaysa sistem açık depolamaya düşmez. Şifreli kayıt yüklenirken
özel/açık anahtar çifti imzalı challenge ile doğrulanır.

## Sonuçlar

- Cihaz özel anahtarı kaynak veri veya yedek içeriğiyle birlikte açık kalmaz.
- Mevcut kurulumlar cihaz güvenini kaybetmeden güvenli biçime taşınır.
- Linux geliştirme ortamında güvenli backend yoksa zorunlu olmayan test yolu
  kullanılabilir; paketli/Windows uygulama fail-closed kalır.
- Gerçek Windows DPAPI oluşturma, yeniden açma ve migration kanıtı promotion
  öncesinde ayrıca çalıştırılır.
