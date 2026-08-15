# 34-E Tehdit Modeli — Yerel öncelikli çeviri ve altyazı

Durum: PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE
Requirement kabulü: false

## Korunan varlıklar

- Sahibine bağlı dil tercihleri ve kişisel sözlük terimleri
- Çeviri hazırlık talebi metadata'sı ve kullanıcı düzeltmesi özeti
- PEP receipt/fence/projection, mutasyon, olay, audit ve outbox bütünlüğü
- Orijinal mesaj, belge, ses ve altyazının sağlayıcıya aktarılmaması
- Renderer'ın provider, ağ, dosya ve kimlik bilgisi yetkisi kazanmaması

## Tehditler ve kontroller

1. Çapraz sahip okuma/yazma: account, person, family ve owner eşliği hem repository sorgusunda hem receipt triggerında zorunludur.
2. Policy bypass: payload-free resource resolver ve merkezi Life PEP olmadan DataStore fail-closed kalır; current/mutation yazımı durable receipt ve writable fence olmadan reddedilir.
3. Replay veya revision atlama: aynı `clientOperationId` farklı fingerprint ile çatışır; current satır yalnız exact previous revision ile ilerler.
4. Düzeltme plaintext sızıntısı: current satırda yalnız SHA-256 ve karakter sayısı; mutation/event/audit/outbox content-free kalır.
5. Sözlük silme sızıntısı: silinen girdinin kaynak ve tercih terimi boşaltılır, append-only kanıt korunur.
6. Sahte provider başarısı: şema ve IPC sonucu providerConfigured, execution, network ve cloud alanlarını false'a kilitler.
7. Onaysız dış sağlayıcı hazırlığı: `external_preview` yalnız preview acknowledgement ve explicit consent birlikte true ise kabul edilir; yine de içerik aktarılmaz.
8. Renderer authority genişlemesi: sekiz exact kanal, recursive plain-object kontrolü, extra key/path/credential/prototype reddi, bounded admission/rate ve non-cancellable durable write uygulanır.
9. Transaction parçalanması: downstream audit/outbox hatası mutation, current row ve event'i birlikte rollback eder.
10. Kalıcı kota DoS'u: owner başına 256 sözlük girdisi, 256 talep ve 4096 mutation sınırı vardır. Yaşam boyu prune/retention politikası henüz tasarlanmamıştır ve residual risk olarak açıktır.

## Açık riskler

- Gerçek yerel dil paketi ve production `TranslationProviderPort` adapterı yoktur.
- Dil algılama, çeviri kalitesi, düşük güven/çok anlamlılık, STT, diarization, caption translation ve TTS UAT yapılmadı.
- Dış provider veri minimizasyonu, endpoint pinning, sözleşme/hukuk ve açık rıza teslim zinciri yoktur.
- Şifreli cihazlar arası tercih ve sözlük senkronizasyonu yoktur.
- Retention expiry, yedek propagasyonu ve fiziksel silme kanıtı yoktur.
- Gizlilik, hukuk, güvenlik, erişilebilirlik ve dil kalitesi incelemeleri `NOT_RUN` durumundadır.

Bu açıklar kapanmadan requirement PASS, provider delivery, offline language availability veya sertifikasyon iddiası üretilemez.
