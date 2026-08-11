# Release Notes — Build222

Build222, exact-source Build221 gerçek Windows testinde görülen preload TypeScript TS7017 hatasını düzeltir.

- Build221 Windows failure evidence exact-source olarak kabul edildi ve sanitize edilerek kaydedildi.
- Önceki bootstrap/workspace build/dist guard düzeltmeleri korunur.
- Doğrudan `globalThis.addEventListener` erişimi yerine dar typed renderer lifecycle target eklendi.
- Runtime `beforeunload` cancellation davranışı korunur.
- ES2024-only TypeScript A/B regresyonu eski ifadenin TS7017 verdiğini ve yeni adapter'ın derlendiğini doğrular.
- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD222.cmd`.
- Yeni: Build222 Windows closure runner/lifecycle/result verifier yüzeyleri.
- OPEN-021 ve OPEN-022 gerçek Build222 Windows evidence dönmeden kapanmaz.
- OPEN-002 otomatik kapanmaz.
