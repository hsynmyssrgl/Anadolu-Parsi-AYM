# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 178

- Application Version: `30.07.2026.178`
- Package Version: `30.7.2026-178`
- Stage: **Bronze RC2 Active Development**
- Main topic: **Kalıcı imzalı güvenlik makbuzu geçmişi ve ana süreç doğrulaması**

## Uygulanan değişiklik

Build 176'nın Ed25519 makbuzları artık uygulama yeniden başlatıldığında kaybolmaz. Makbuzlar hesap parmak izine göre filtrelenen, atomik yazılan sınırlı bir ana süreç arşivinde tutulur. Güvenlik Merkezi geçmişi listeler, imza durumunu gösterir ve dışarıdan yapıştırılan JSON makbuzunu ana süreçte doğrular.

## Hedefli doğrulama

- Build 178 sözleşme: **37/37 PASS**
- Build 178 runtime: **19/19 PASS**
- Build 178 sözdizimi/TypeScript: **11/11 PASS**
- Build 177 devamlılığı: **31/31 + 13/13 + 10/10 PASS**

## Nihai kaynak doğrulaması

- Source preflight: **150/150 PASS**
- Source integrity: **PASS**
- Validation boundary: **2 PASS / 0 FAIL / 6 NOT_RUN — INCOMPLETE**

## Aşama sınırı

Build 178 Final, Code Freeze, Silver veya Gold değildir. Geniş bağımlılık, production ve Windows kapıları çalıştırılmadan promotion yapılmaz.
