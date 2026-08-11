# ADR-012: Belge Yetkisi ve Ana Karar Defteri

**Durum:** Build 127 ile kabul edildi.

**Karar:** En son açık kullanıcı kararı ve aktif kaynak sözleşmesi eski belge
metinlerinden üstündür. Her önemli karar `DEC-xxx` kimliğiyle ana karar defterine
ve ilgili uzmanlık belgesine işlenir.

**Sonuç:** Tarihsel PDF/DOCX ve Build raporları korunur fakat aktif davranışı
belirlemez. Çelişki sessizce birleştirilmez; etki analizi ve revizyon kaydı gerekir.
