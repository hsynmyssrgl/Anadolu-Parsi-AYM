# DEC-129 — Tüm aktif kurallar aşılamaz yürütme çekirdeğine bağlanır

- Tarih: 04.08.2026
- Sürüm: Bronze 04.08.2026.29
- Durum: ACTIVE
- Kaynak: Kullanıcının “Tüm kuralları aşılamaz hale getir tek tek uğraşmayayım” kararı.

## Karar

Bütün ACTIVE proje kuralları tekil bir enforcement kaydı taşır. Her kayıt fail-closed, waiver/skip/ignore yolu kapalı ve kanıta bağlıdır. Doğrudan makineyle ispatlanabilen kurallar otomatik gate/runtime kontrolüne; dış ortam gerektiren kurallar ise zorunlu dış kanıt kapısına bağlanır. Kanıt yoksa ilgili aşama BLOCKED kalır ve Silver/Gold geçişi yapılamaz. PR-171 ayrıca adım/checkpoint durum makinesiyle uygulanır; önceki adım doğrulanıp kalıcı checkpoint kanıtı oluşmadan sonraki adım başlatılamaz.

## Güvence sınırı

Doğal dildeki her iş kuralının tüm gerçek dünya ihlallerini matematiksel olarak önceden kanıtlamak mümkün değildir. Bu nedenle “aşılamaz” burada süreç açısından istisnasız fail-closed anlamındadır: kural atlanamaz, sessizce PASS verilemez ve kanıtsız aşama ilerleyemez.
