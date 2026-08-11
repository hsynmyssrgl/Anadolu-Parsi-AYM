# DEC-113 — Build221 gerçek Windows failure evidence ve Build222 preload TypeScript düzeltmesi

Build221 exact-source gerçek Windows koşusunda source integrity, root `npm ci`, isolated `windows-packager` bootstrap, `npm run build:packages` ve workspace dist guard PASS oldu. Installer build, `apps/desktop/src/main/preload.ts` satır 146'daki doğrudan `globalThis.addEventListener` erişiminin Electron main/preload derlemesindeki ES2024-only lib + Node types sözleşmesiyle uyuşmaması nedeniyle TS7017 ile durdu.

Build222 runtime davranışını değiştirmeden `beforeunload` için dar ve opsiyonel bir typed renderer lifecycle target kullanır. Kaynak sözleşmesi, Build221 ifadesinin TS7017 verdiğini ve Build222 adapter'ın aynı ES2024-only TypeScript koşulunda derlendiğini A/B regresyonuyla kanıtlar. Build221 tarihsel teslimi değiştirilmez. OPEN-021/OPEN-022 exact Build222 gerçek Windows evidence gelmeden kapanmaz.
