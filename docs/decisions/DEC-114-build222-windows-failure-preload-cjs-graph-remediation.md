# DEC-114 — Build222 gerçek Windows failure evidence ve Build223 preload CJS graph düzeltmesi

Build222 exact-source gerçek Windows koşusunda source integrity, root `npm ci`, isolated Windows packager bootstrap, workspace build ve dist guard PASS; installer build ise geçici `preload.cts` içine yalnız `preload.ts` kopyalandığı için üç relative IPC modülü bulunamadı (`TS2307`) ve `.cts` generic arrow sözdizimi iki noktada `TS7060` üretti.

Build223, preload ile üç yerel IPC bağımlılığını tek CommonJS TypeScript staging grafiğinde derler; staged relative IPC import specifier'larını `.cjs` olarak yeniden yazar ve `.cts` generic arrow type-parametrelerini trailing-comma biçimine normalize eder. Preload'daki iki generic invoker function declaration'a çevrilir. Focused compile/tamper runtime valid graph'ın `preload.cjs` + üç local `.cjs` çıktısını ürettiğini ve eksik dependency'de fail-closed davrandığını doğrular.

OPEN-021/OPEN-022 exact Build223 gerçek Windows evidence gelmeden kapanmaz. ADR-097 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD223.md` bağlayıcıdır.
