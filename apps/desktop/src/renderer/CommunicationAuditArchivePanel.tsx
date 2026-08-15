export function CommunicationAuditArchivePanel(){return <section className="communication-audit-archive panel" aria-labelledby="communication-audit-archive-title">
  <div className="panel-heading"><div><span className="eyebrow">34-H · İletişim audit ve arşiv bütünlüğü</span><h2 id="communication-audit-archive-title">İçerikten ayrı denetim zinciri</h2></div></div>
  <div className="communication-recording-truth" role="note"><strong>Audit olayları mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz.</strong>
    <span>Oda giriş/çıkış, çağrı başlangıç/bitiş, dosya paylaşımı ve izin değişimi yalnız kimlik, hash, sürüm, cihaz ve zaman metadatasıyla modellenir.</span>
    <span>Ledger append-only ve previousHash→eventHash zincirlidir; SQLite trigger’ları update/delete işlemlerini reddeder.</span>
    <span>Kasa/veritabanı/yedek/restore manifest checkpoint’i vardır; gerçek remote replikasyon, dış yedek sağlayıcısı ve restore tatbikatı doğrulanmamıştır.</span></div>
  <p>Güncel çalışma modu: <strong>yerel şema ve use-case hazır · production composition bağlı değil</strong>.</p>
  <button type="button" disabled>Audit zincirini kalıcı merkezden doğrula</button><small>Bu UI henüz kalıcı query/API portuna bağlı değildir.</small>
  </section>;}
