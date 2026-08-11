# Dependency Audit — Bronze MVP-44

- Yeni harici npm bağımlılığı eklenmedi.
- Desktop uygulamasına yalnızca mevcut monorepo workspace paketleri `@ppt/events` ve `@ppt/repositories` bağlandı.
- Repository paketi yalnızca `@ppt/core`, `@ppt/database` ve `@ppt/events` yerel paketlerine bağımlıdır.
- Renderer bağımlılık yüzeyi değişmedi.
- Kaynak teslim paketine `node_modules`, `dist`, `release`, `.tmp` veya cache klasörü alınmayacaktır.
