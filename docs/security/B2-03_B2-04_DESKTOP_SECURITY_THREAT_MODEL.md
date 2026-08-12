# B2-03/B2-04 Masaüstü Güvenlik Tehdit Modeli

## Korunan varlıklar

- Açık aile, sağlık, finans, konum ve arşiv ekranları
- Kaydedilmemiş form durumu
- Kimliği doğrulanmış oturum ve yeniden doğrulama sınırı
- Renderer dosya erişimi, Electron API yüzeyi ve paketlenmiş executable

## Tehditler ve kontroller

| Tehdit | Kontrol | Fail-closed kanıt |
|---|---|---|
| Arka plan işi oturumu sonsuza kadar açık tutar | Repository auth kontrolleri `touch:false`; yalnız gerçek input açık activity IPC çağırır | Session unit test ve 25 maddeli kaynak sınırı |
| Uyarı erişilemez veya kullanıcı açık formunu kaybeder | 60 saniyelik odak kapanlı `alertdialog`; React ağacı mounted kalır | Renderer integration testi |
| Kilit parola/MFA olmadan atlanır | Aynı hesap için mevcut login use-case'iyle parola ve etkin TOTP yeniden doğrulaması | Application/session testleri ve exact IPC payload politikası |
| Kilit geçişi inkâr edilir | Idle, manuel kilit ve açma mevcut append-only audit zincirine yazılır | DataStore composition sözleşmesi |
| `file://` veya XSS yerel dosyalara geniş erişim verir | `pardus-app://renderer` özel protokolü, host ve kök yol kısıtı | Yanlış host, credentials, traversal ve malformed URL negatif testleri |
| Renderer Electron/Node yetkisi kazanır | Sandbox, context isolation, Node kapalı, web security açık, dar preload | Renderer preference ve integration testleri |
| Ağ, pencere, izin veya webview sınırı aşılır | CSP; permission/download/navigation/redirect/webview/new-window varsayılan DENY | Session-security listener testleri |
| Paket yükseltmesinde yeni fuse sessizce açık kalır | `strictlyRequireAllFuses: true`; tüm fuse'lar exact adla yazılır ve readback edilir | Electron 43 eski araç negatif bulgusu ve 9/9 ikili kanıtı |
| ASAR dışından kod yüklenir veya komut satırı Node modu açılır | ASAR integrity ve OnlyLoadAppFromAsar açık; RunAsNode, NODE_OPTIONS ve CLI inspect kapalı | Static 11 kontrol + gerçek ikili readback |

## Güven sınırları

Renderer yalnız içeriksiz kilit ve güvenlik posture görünümü alır. Hesap kimliği,
parola, TOTP kodu, allowlist kaynak yolu veya kalıcı veri renderer status yanıtına
eklenmez. Özel protokol dosya sunumu yalnız paketli renderer kökü içindir.

## Kapsam dışı

Bu kapanış production code-signing sertifikası sağlamaz, release eligibility
açmaz ve B2-02 fiziksel WebAuthn/FIDO2 kabulünü ikame etmez.
