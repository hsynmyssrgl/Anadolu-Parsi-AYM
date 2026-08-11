# ADR-004: Nesne Düzeyi Yetkilendirme ve Açık Ret Önceliği

**Durum:** Kabul edildi ve uygulanıyor.

**Karar:** Rol tabanlı yetki tek başına yeterli değildir. Aktör, veri sahibi,
nesne, işlem, aile/dal, amaç, süre, allow/deny ve AI izni birlikte değerlendirilir.

**Sonuç:** Açık ret rol, sahiplik ve wildcard izninden üstündür. Aile yöneticisi
başka yetişkinin özel sağlık/finans verisine otomatik erişemez.
