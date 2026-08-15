import { useState } from 'react';
export function CommunicationFileSharingPanel(){const [accessMode,setAccessMode]=useState<'preview_only'|'download'>('preview_only');
  const [quiet,setQuiet]=useState(true);return <section className="communication-file-sharing panel" aria-labelledby="communication-file-sharing-title">
    <div className="panel-heading"><div><span className="eyebrow">34-G · E2EE dosya ve iletişim UX</span><h2 id="communication-file-sharing-title">Dosya paylaşımı güvenlik planı</h2></div></div>
    <div className="communication-recording-truth" role="note"><strong>Üretim dosya aktarımı ve yerel zararlı dosya tarayıcısı yapılandırılmamıştır.</strong>
      <span>Dosya seçimi burada byte okumaz; E2EE zarfı, 4 MiB parça/hash, resumable durum ve tam dosya hash sözleşmesi ana süreç sağlayıcısına aittir.</span>
      <span>Haricî link varsayılan kapalıdır; etkinleştirme ancak süre sonu ve erişim koduyla modellenebilir. Bu sürüm link üretmez.</span>
      <span>Uzaktan yardım tek kullanımlık açık rıza, görünür gösterge, parola/güvenli masaüstü gizleme ve anlık iptal olmadan başlayamaz; transport yoktur.</span></div>
    <div className="workspace-grid"><section><h3>Erişim planı</h3><label>Yerel erişim modu<select value={accessMode}
      onChange={event=>setAccessMode(event.target.value as 'preview_only'|'download')}><option value="preview_only">Yalnız güvenli önizleme</option>
      <option value="download">İndirme izni</option></select></label><p>Seçim: <strong>{accessMode==='preview_only'?'Yalnız önizleme':'İndirme'}</strong> · süreli grant zorunlu.</p>
      <button type="button" disabled>Dosya seç ve şifreli aktarımı başlat</button><small>Payload/vault sağlayıcısı bileşik olmadığı için fail-closed.</small></section>
      <section><h3>Bildirim ve acil duyuru</h3><label><input type="checkbox" checked={quiet} onChange={event=>setQuiet(event.target.checked)}/> Sessiz saatler</label>
        <p>Acil olmayan özet: {quiet?'haftalık toplama':'anlık yerel metadata'}.</p><button type="button" disabled>Acil aile duyurusu gönder</button>
        <small>Acil servis garantisi değildir; gerçek teslim sağlayıcısı yoktur.</small></section></div>
    <div className="communication-recording-truth"><span>Albüm ortak seçim/beğeni/aile hikâyesi aktarımı yalnız metadata modelidir.</span>
      <span>SharePlay, sesli komut çalıştırma ve remote collaboration sağlayıcıları kapalıdır; sesli işlem önce açık doğrulama ister.</span></div>
  </section>;}
