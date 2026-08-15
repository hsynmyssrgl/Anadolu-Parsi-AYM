# 34-J Tehdit Modeli

- Discovery sonucu güven/kimlik sayılmaz; her bağlantı mTLS ve Core Service policy ister.
- Control plane içerik alanlarını kabul etmez; relay şifreli zarfı çözemez.
- Apple UI izni Core Service reddini aşamaz; offline cache ana veri kaynağı değildir.
- Replica ile backup karıştırılamaz; restore policy version ve key epoch uyumu ister.
- Rolling update lideri sona koyar, imzalı paket/N-1/rollback olmadan ilerlemez.
- Fault injection kanıtı gerçek Windows node çalıştırılmadıkça sentetik olarak etiketlenir.

Residual risk: tüm production provider'lar ve gerçek DR/UAT kanıtları eksiktir.
