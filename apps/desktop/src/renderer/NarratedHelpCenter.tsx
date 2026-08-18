import { useEffect, useMemo, useRef, useState } from 'react';

export type SilverHelpTopicId = 'getting-started' | 'current-screen' | 'privacy' | 'accessibility' | 'troubleshooting';
export type SilverHelpNarrationStatus = 'idle' | 'speaking' | 'ready' | 'unavailable' | 'error';

export interface SilverHelpTopic {
  id: SilverHelpTopicId;
  title: string;
  summary: string;
  narration: string;
}

export const SILVER_HELP_TOPICS: readonly SilverHelpTopic[] = Object.freeze([
  Object.freeze({
    id: 'getting-started',
    title: 'Başlangıç ve temel kullanım',
    summary: 'Aile alanına giriş, menüler ve ilk kayıt adımları.',
    narration: 'Başlangıç yardımındasınız. Önce sol menüden çalışmak istediğiniz bölümü açın. Yeni bir kayıt eklemeden önce doğru aile alanında olduğunuzu kontrol edin. Kaydetme işleminden sonra ekrandaki başarı veya hata mesajını okuyun. Uygulama aile verilerini siz giriş yapmadan açmaz.'
  }),
  Object.freeze({
    id: 'current-screen',
    title: 'Bulunduğum ekranı anlat',
    summary: 'Açık bölümün yerini ve güvenli kullanım biçimini açıklar.',
    narration: 'Bulunduğunuz ekranın adı üst çubukta ve ana içerik başlığında gösterilir. Sekme ile etkileşimli kontrollere ilerleyebilir, Shift ve Sekme ile geri dönebilirsiniz. Bir işlem düğmesine basmadan önce ekran başlığını ve seçili aile alanını kontrol edin.'
  }),
  Object.freeze({
    id: 'privacy',
    title: 'Gizlilik ve güvenlik',
    summary: 'Yerel veri, oturum kilidi, yedekleme ve hassas işlemler.',
    narration: 'Gizlilik yardımındasınız. Kişisel veriler yalnız kimliğiniz doğrulandıktan sonra açılır. Bilgisayardan ayrılırken oturumu kilitleyin. Kurtarma kodlarını uygulamanın dışında güvenli bir yerde saklayın. Dış sağlayıcı kullanan bir işlem varsa kapsamı ve onay metnini okumadan devam etmeyin.'
  }),
  Object.freeze({
    id: 'accessibility',
    title: 'Erişilebilirlik ve ses',
    summary: 'Yazı boyutu, kontrast, hareket azaltma ve sesli anlatım.',
    narration: 'Erişilebilirlik yardımındasınız. Güvenlik Merkezindeki görünüm tercihlerinden yazı boyutunu, kontrastı, okuma modunu ve hareket azaltmayı değiştirebilirsiniz. Bu yardım metnini normal veya yavaş hızda dinleyebilirsiniz. Ses kapalıyken aynı açıklama ekranda yazılı kalır.'
  }),
  Object.freeze({
    id: 'troubleshooting',
    title: 'Sorun giderme',
    summary: 'Açılmama, yüklenme, çevrimdışı durum ve güvenli yeniden deneme.',
    narration: 'Sorun giderme yardımındasınız. Ekran yüklenmiyorsa önce Yeniden dene düğmesini kullanın. Çevrimdışı uyarısında verileri tekrar tekrar göndermeyin. Uygulama açılmıyorsa Windows tarihini, boş disk alanını ve uygulama kayıtlarını kontrol edin. Aynı hata sürerse hata metnini ve oluştuğu saati not edin.'
  })
]);

interface HelpNarrationUtterance {
  lang: string;
  rate: number;
  pitch: number;
}

interface HelpNarrationSynthesis<TUtterance extends HelpNarrationUtterance> {
  cancel(): void;
  speak(utterance: TUtterance): void;
}

export const silverHelpNarrationText = (topic: SilverHelpTopic, activeScreenLabel: string): string =>
  topic.id === 'current-screen'
    ? `Şu anda ${activeScreenLabel} bölümündesiniz. ${topic.narration}`
    : topic.narration;

export const startSilverHelpNarration = <TUtterance extends HelpNarrationUtterance>(input: {
  text: string;
  rate: 'normal' | 'slow';
  synthesis: HelpNarrationSynthesis<TUtterance> | undefined;
  createUtterance: ((text: string) => TUtterance) | undefined;
  onStatus: (status: SilverHelpNarrationStatus) => void;
}): SilverHelpNarrationStatus => {
  if (!input.synthesis || !input.createUtterance) {
    input.onStatus('unavailable');
    return 'unavailable';
  }
  try {
    input.synthesis.cancel();
    const utterance = input.createUtterance(input.text);
    utterance.lang = 'tr-TR';
    utterance.rate = input.rate === 'slow' ? 0.72 : 0.88;
    utterance.pitch = 0.95;
    Object.assign(utterance, {
      onstart: () => input.onStatus('speaking'),
      onend: () => input.onStatus('ready'),
      onerror: () => input.onStatus('error')
    });
    input.onStatus('speaking');
    input.synthesis.speak(utterance);
    return 'speaking';
  } catch {
    input.onStatus('error');
    return 'error';
  }
};

const speechSynthesis = (): SpeechSynthesis | undefined =>
  typeof globalThis.speechSynthesis === 'undefined' ? undefined : globalThis.speechSynthesis;

const narrationStatusText: Readonly<Record<SilverHelpNarrationStatus, string>> = Object.freeze({
  idle: 'Dinlemek istediğiniz başlığı seçin.',
  speaking: 'Sesli anlatım sürüyor.',
  ready: 'Anlatım tamamlandı.',
  unavailable: 'Bu cihazda sesli anlatım kullanılamıyor; metni ekrandan okuyabilirsiniz.',
  error: 'Sesli anlatım başlatılamadı; metin görünür durumda.'
});

export function NarratedHelpCenter({
  activeScreenLabel,
  audioMuted,
  onAudioMutedChange,
  onClose
}: {
  activeScreenLabel: string;
  audioMuted: boolean;
  onAudioMutedChange: (muted: boolean) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<SilverHelpTopicId>('getting-started');
  const [rate, setRate] = useState<'normal' | 'slow'>('normal');
  const [status, setStatus] = useState<SilverHelpNarrationStatus>('idle');
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const selected = SILVER_HELP_TOPICS.find((topic) => topic.id === selectedId) ?? SILVER_HELP_TOPICS[0]!;
  const text = useMemo(() => silverHelpNarrationText(selected, activeScreenLabel), [activeScreenLabel, selected]);

  const stop = () => {
    try { speechSynthesis()?.cancel(); } catch { /* Metin her durumda görünür kalır. */ }
    setStatus('idle');
  };
  const speak = () => {
    if (audioMuted) onAudioMutedChange(false);
    startSilverHelpNarration({
      text,
      rate,
      synthesis: speechSynthesis(),
      createUtterance: typeof globalThis.SpeechSynthesisUtterance === 'undefined'
        ? undefined
        : (value) => new globalThis.SpeechSynthesisUtterance(value),
      onStatus: setStatus
    });
  };

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      try { speechSynthesis()?.cancel(); } catch { /* Kapanış ses hatası kullanıcı akışını engellemez. */ }
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="narrated-help-overlay" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} id="narrated-help-dialog" className="narrated-help-center" role="dialog" aria-modal="true" aria-labelledby="narrated-help-title" aria-describedby="narrated-help-description" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()} onKeyDown={handleDialogKeyDown}>
      <header>
        <div><span className="eyebrow">Silver erişilebilirlik hazırlığı</span><h2 id="narrated-help-title">Sesli Yardım Merkezi</h2><p id="narrated-help-description">İstediğiniz konuyu seçin; açıklamayı okuyun veya Türkçe olarak dinleyin.</p></div>
        <button type="button" className="narrated-help-close" autoFocus aria-label="Yardım Merkezini kapat" onClick={onClose}>×</button>
      </header>
      <div className="narrated-help-layout">
        <nav aria-label="Yardım konuları">
          {SILVER_HELP_TOPICS.map((topic) => <button type="button" key={topic.id} aria-current={selected.id === topic.id ? 'page' : undefined} onClick={() => { stop(); setSelectedId(topic.id); }}><strong>{topic.title}</strong><span>{topic.summary}</span></button>)}
        </nav>
        <article aria-live="polite">
          <span className="eyebrow">{selected.title}</span>
          <h3>{selected.id === 'current-screen' ? `${activeScreenLabel} bölümü` : selected.title}</h3>
          <p>{text}</p>
          <div className="narrated-help-controls">
            <button type="button" className="primary" onClick={speak}>{status === 'speaking' ? 'Baştan anlat' : audioMuted ? 'Sesi aç ve anlat' : 'Sesli anlat'}</button>
            <button type="button" disabled={status !== 'speaking'} onClick={stop}>Durdur</button>
            <button type="button" aria-pressed={rate === 'slow'} onClick={() => { stop(); setRate((value) => value === 'normal' ? 'slow' : 'normal'); }}>{rate === 'slow' ? 'Normal hız' : 'Daha yavaş'}</button>
            <button type="button" aria-pressed={audioMuted} onClick={() => { stop(); onAudioMutedChange(!audioMuted); }}>{audioMuted ? 'Sesi aç' : 'Sesi kapat'}</button>
          </div>
          <small role="status">{narrationStatusText[status]}</small>
        </article>
      </div>
      <footer><span>F1 ile açılır</span><span>Esc ile kapanır</span><span>Metin her zaman görünür kalır</span></footer>
    </section>
  </div>;
}
