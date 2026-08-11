# ADR-007: Sağlayıcı Soyutlama

**Durum:** Kabul edildi ve uygulanıyor.

**Karar:** AI, harita, bildirim, depolama, kimlik ve bulut yedek sağlayıcıları
adapter arayüzleriyle bağlanır.

**Sonuç:** OneDrive öncelikli bulut yedek hedefidir; iCloud, Google Drive ve
diğer sağlayıcılar aynı sözleşmeyle eklenebilir. Sağlayıcı kimliği yerel rol ve
veri erişim yetkisi vermez.
