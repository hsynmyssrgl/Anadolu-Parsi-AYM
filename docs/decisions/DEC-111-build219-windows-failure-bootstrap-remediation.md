# DEC-111 — Build219 gerçek Windows failure evidence ve Build220 bootstrap düzeltmesi

Build219 exact-source Windows kanıtı kaynak bütünlüğü ve root `npm ci` adımlarını geçti, ancak installer build exit code 1 ile durdu. Kök neden, `electron-builder` aracının güvenlik amacıyla `tools/windows-packager` altında izole tutulmasına rağmen Build219 birleşik runner'ın bu ayrı dependency graph için `npm run windows-packager:install` çalıştırmamasıdır.

Build220 bu bootstrap adımını zorunlu prerequisite yapar ve builder CLI yoksa fail-closed durur. Windows PowerShell 5.1 UTF-8 kaynak çözümleme farkı nedeniyle Build220 `.ps1` runner/lifecycle dosyaları UTF-8 BOM taşır. Installer/process stdout ve stderr sonları lifecycle kanıtına yazılır.

Build219 tarihsel teslimi değiştirilmez. OPEN-021/OPEN-022 gerçek Build220 Windows kanıtı gelmeden kapanmaz.
