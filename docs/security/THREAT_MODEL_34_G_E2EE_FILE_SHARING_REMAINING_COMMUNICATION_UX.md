# 34-G Tehdit Modeli

- Plaintext, dosya yolu, hash, sealed reference veya policy/identity authority renderer/SQLite sınırına sızarsa işlem reddedilir.
- Main dosya seçimi absolute regular-file, realpath, no-follow, inode/device, tek hard-link ve 64 MiB sınırına bağlıdır; seçilen byte'lar kullanım sonunda zeroize edilir.
- Korumalı payload yayını no-overwrite ve readback doğrulamalıdır; yabancı owner/account/family/file bağı, hard-link ve zarf tahrifi fail-closed reddedilir.
- Current ve immutable mutation yazımı exact PEP receipt/fence/projection/account/person/family/owner/resource/action/capability/purpose bağı olmadan trigger düzeyinde reddedilir.
- Parça index/offset/hash yeniden oynatma ve aynı index için farklı hash çatışmadır.
- Temiz tarama kanıtı olmadan erişim grant'i açılamaz; zararlı sonuç karantinaya gider.
- Önizleme yalnız exact owner/file read receipt'i, `ready_local/clean` durum, 256 KiB sınırı ve sınırlı metin MIME setiyle açılır; bozuk UTF-8, kontrol/bidi karakterleri, hash/path/sealed reference veya geniş sonuç IPC kapısında reddedilir.
- Haricî link varsayılan kapalıdır; gerçek link sağlayıcısı yoktur.
- Uzaktan yardım görünmez veya sürekli rıza kullanamaz; parola ve güvenli masaüstü gizleme zorunludur.
- Acil aile duyurusu gerçek teslim veya acil servis garantisi sayılmaz.

Residual risk: gerçek cihazlar-arası E2EE transport, production scanner bileşimi/UAT, gerçek scanner-backed preview UAT, remote assistance, SharePlay, voice provider, mutation-ledger lifetime retention kararı, accessibility/security/privacy UAT ve formal kalıcı kapanış receipt'i yoktur. Process çökmesiyle DB kaydından önce kalabilecek şifreli payload için açılış hard-link recovery, exact retry reuse, hazırlık öncesi ve aktif kimlik doğrulanmış oturum scheduler'ında owner-bound 24 saat grace sweep testlidir. Oturum hiç açılmazsa bakım çalışmaz. 4096 mutation lifetime kotası ürün retention kararı olmadan acceptance sayılmaz.
