# Masaüstü Oturum ve Electron Güvenlik Sözleşmesi

Bu belge B2-03 ve B2-04 için çalışan güncel masaüstü davranışını özetler.

## Oturum

| Kural | Değer |
|---|---|
| Boşta kalma kilidi | 15 dakika |
| Erişilebilir uyarı | Son 60 saniye |
| Süreyi uzatan sinyaller | `pointerdown`, `keydown`, `touchstart` |
| Arka plan işi süreyi uzatır mı? | Hayır |
| Açık form/modal durumu kilitte korunur mu? | Evet; React ağacı mounted kalır |
| Açma doğrulaması | Aynı hesap parolası ve etkinse TOTP |
| Audit | Idle kilit, manuel kilit ve açma |

## Electron renderer

| Kural | Değer |
|---|---|
| Production origin | `pardus-app://renderer` |
| `file://` primary renderer | Yasak |
| CSP | Response header; `default-src 'none'` |
| Node integration | Kapalı |
| Context isolation / sandbox / web security | Açık |
| Permission, download, navigation, redirect, webview, yeni pencere | Varsayılan ret |
| Protokol yolu | Renderer köküne hapsolmuş; host, credentials, traversal ve malformed URL reddedilir |

## Electron 43 fuse tablosu

| Fuse | Değer |
|---|---|
| RunAsNode | Kapalı |
| EnableCookieEncryption | Açık |
| EnableNodeOptionsEnvironmentVariable | Kapalı |
| EnableNodeCliInspectArguments | Kapalı |
| EnableEmbeddedAsarIntegrityValidation | Açık |
| OnlyLoadAppFromAsar | Açık |
| LoadBrowserProcessSpecificV8Snapshot | Açık |
| GrantFileProtocolExtraPrivileges | Kapalı |
| WasmTrapHandlers | Açık |

Paketleme `afterPack` aşamasında tüm dokuz fuse'u
`strictlyRequireAllFuses: true` ile yazar ve bağımsız readback yapar. İşlem kod
imzalamadan önce gerçekleşir.

## Kanıtlar

- `artifacts/validation/32-X-b2-03-b2-04-desktop-security-boundary.json`
- `artifacts/validation/32-X-electron-fuse-binary-proof.json`
- `artifacts/validation/32-X-b2-03-b2-04-desktop-security-contract.json`
- `artifacts/validation/32-X-b2-03-b2-04-desktop-security-runtime.json`
- `packages/security/tests/session-lock.test.ts`
- `packages/application/tests/desktop-security-use-cases.test.ts`
- `apps/desktop/tests/b2-desktop-security-integration.test.ts`
