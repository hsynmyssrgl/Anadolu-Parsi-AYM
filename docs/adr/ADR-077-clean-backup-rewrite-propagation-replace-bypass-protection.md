# ADR-077 — Referanslanmış propagation kimliğinde INSERT koruması

## Karar

`backup_propagation_runs` tablosuna yapılan INSERT, `NEW.id` değerinin bir temiz-yedek çalışma kaydı tarafından referanslanması hâlinde fail-closed reddedilir.

## Gerekçe

SQLite REPLACE çatışma çözümü, `recursive_triggers` kapalıyken mevcut satırı silip yeniden ekleyebilir ve DELETE/UPDATE değişmezlik tetikleyicilerini etkisiz bırakabilir. BEFORE INSERT koruması çatışma çözümünden bağımsızdır ve bağlı kanıtın yeniden oluşturulmasını önler.

## Sonuç

Referanslanmamış yeni veya değiştirilebilir propagation kayıtlarının normal INSERT/REPLACE davranışı korunur; bağlı kanıt kimliği yeniden eklenemez.
