# ADR-011: Bağımsız Yedek Hedefleri ve Cihazın Yeniden Yetkilendirilmesi

**Durum:** Kabul edildi.

**Karar:** Yerel, harici ve bulut yedek hedefleri bağımsız çalışır. Her hedef
ayrı sağlık ve bütünlük kanıtı üretir.

**Sonuç:** Bir hedef hatası diğerlerini durdurmaz; en az bir doğrulanmış tam
yedek korunur. Restore edilen yeni cihaz otomatik güvenilir sayılmaz.
