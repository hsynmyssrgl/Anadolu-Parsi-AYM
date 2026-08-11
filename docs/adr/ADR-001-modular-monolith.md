# ADR-001: Modüler Monolit ve Katman Yönü

**Durum:** Kabul edildi ve uygulanıyor.

**Karar:** İlk ürün modüler monolittir. Bağımlılık yönü
`UI → Application → Domain → Infrastructure` şeklindedir. Modüller açık portlar,
manifestler ve veri sahipliği sınırlarıyla ayrılır.

**Sonuç:** Application/renderer ham SQL çalıştıramaz; somut repository ve
transaction implementasyonları composition root içinde oluşturulur. İleride
platform veya servis ayrıştırması sözleşmeler korunarak yapılabilir.
