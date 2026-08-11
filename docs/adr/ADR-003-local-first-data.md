# ADR-003: Yerel-Öncelikli Veri ve Kullanıcı Sahipliği

**Durum:** Kabul edildi ve uygulanıyor.

**Karar:** Birincil veri kullanıcının cihazında tutulur; bulut hesabı zorunlu
değildir. Kullanıcı verisinin sahibi kullanıcıdır.

**Sonuç:** SQLite metadata/ilişki deposudur; büyük dosyalar içerik-adresli
şifreli kasadadır. Bulut yalnız bağımsız yedek/senkronizasyon adapteri olarak
eklenir. Restore yeni cihaza otomatik güven vermez.
