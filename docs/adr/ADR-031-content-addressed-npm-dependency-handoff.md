# ADR-031 — Content-addressed npm dependency handoff

## Status

Accepted — Bronze RC2 Active Development, Build 154.

## Context

Geliştirme ortamının npm kayıt defterine erişimi yoktur. Build 151–153 bağımlılık
edinme, doğrulanmış kabul ve tam kapı orkestrasyonunu sağlamıştır; ancak talep
kiti ile geri dönen cache paketinin aynı edinme isteğine ait olduğunu kanıtlayan
ayrı bir kimlik bulunmamıştır.

## Decision

Her bağımlılık edinme isteği içerik adresli bir `requestId` ile tanımlanır. Kimlik
aktif lockfile, paket sürümü, temel edinme planı, resmi npm politikası ve tarball
sayısına bağlanır. Talep ZIP'i deterministik ve payload SHA-256 envanterlidir.

Yanıt cache manifesti aynı `handoffRequestId` değerini taşımak zorundadır. Yanıt
doğrulama ve kabul işlemleri beklenen kimliği açıkça alır. Kimlik kabul makbuzu ve
aktif pointer boyunca korunur. Uyuşmayan yanıt cache'e yazılmadan reddedilir ve
karantinaya alınır.

## Consequences

- Eski, başka sürüme veya başka lockfile'a ait cache paketi yanlışlıkla kabul
  edilemez.
- Talep ZIP'i internet bağlantılı makinede proje bağımlılığı kurulmadan
  çalıştırılabilir.
- Geniş doğrulama kapıları yalnız bağlı yanıt kabul edildikten sonra başlar.
- Talep veya yanıt eksikliği PASS/FAIL yerine açık `WAITING` durumu olarak
  raporlanır.
