import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalization } from './localization';
import {waitForPreferredNarrationVoice,type NarrationVoice} from './accessibility';

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

export const SILVER_HELP_TOPICS_EN: readonly SilverHelpTopic[] = Object.freeze([
  Object.freeze({ id:'getting-started', title:'Getting started', summary:'Signing in, menus and the first record steps.', narration:'You are in getting-started help. First open the section you want from the left menu. Before adding a record, confirm that the correct family space is selected. Read the success or error message after saving. The application does not open family data before you sign in.' }),
  Object.freeze({ id:'current-screen', title:'Describe the current screen', summary:'Explains the open section and how to use it safely.', narration:'The current screen name appears in the top bar and the main content heading. Use Tab to move through interactive controls and Shift plus Tab to move back. Check the screen heading and selected family space before pressing an action button.' }),
  Object.freeze({ id:'privacy', title:'Privacy and security', summary:'Local data, session lock, backup and sensitive operations.', narration:'You are in privacy help. Personal data opens only after your identity is verified. Lock the session before leaving the computer. Store recovery codes in a safe place outside the application. If an operation uses an external provider, read its scope and consent notice before continuing.' }),
  Object.freeze({ id:'accessibility', title:'Accessibility and audio', summary:'Text size, contrast, reduced motion and voice narration.', narration:'You are in accessibility help. In Security Center appearance preferences, you can change text size, contrast, reading mode and reduced motion. You can listen to this help at normal or slow speed. The same explanation remains visible when audio is muted.' }),
  Object.freeze({ id:'troubleshooting', title:'Troubleshooting', summary:'Startup, loading, offline status and safe retry.', narration:'You are in troubleshooting help. If a screen does not load, use the Try again button first. Do not repeatedly submit data while an offline warning is visible. If the application does not open, check the Windows date, free disk space and application logs. If the same error continues, record the error text and the time it occurred.' })
]);

interface HelpNarrationUtterance {
  lang: string;
  rate: number;
  pitch: number;
  volume?:number;
  voice?:NarrationVoice|null;
}

interface HelpNarrationSynthesis<TUtterance extends HelpNarrationUtterance> {
  cancel(): void;
  resume?():void;
  speak(utterance: TUtterance): void;
}

export const silverHelpNarrationText = (topic: SilverHelpTopic, activeScreenLabel: string, language: 'tr' | 'en' = 'tr'): string =>
  topic.id === 'current-screen'
    ? language === 'tr' ? `Şu anda ${activeScreenLabel} bölümündesiniz. ${topic.narration}` : `You are currently in ${activeScreenLabel}. ${topic.narration}`
    : topic.narration;

export const startSilverHelpNarration = <TUtterance extends HelpNarrationUtterance>(input: {
  text: string;
  language?: 'tr' | 'en';
  rate: 'normal' | 'slow';
  synthesis: HelpNarrationSynthesis<TUtterance> | undefined;
  createUtterance: ((text: string) => TUtterance) | undefined;
  preferredVoice?:NarrationVoice|null;
  requirePreferredVoice?:boolean;
  onStatus: (status: SilverHelpNarrationStatus) => void;
}): SilverHelpNarrationStatus => {
  if (!input.synthesis || !input.createUtterance) {
    input.onStatus('unavailable');
    return 'unavailable';
  }
  if(input.requirePreferredVoice&&!input.preferredVoice){input.onStatus('unavailable');return'unavailable';}
  try {
    input.synthesis.cancel();
    input.synthesis.resume?.();
    const utterance = input.createUtterance(input.text);
    utterance.lang = input.language === 'en' ? 'en-US' : 'tr-TR';
    utterance.rate = input.rate === 'slow' ? 0.72 : 0.88;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    if(input.preferredVoice)utterance.voice=input.preferredVoice;
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
  onReplayIntroduction,
  onClose
}: {
  activeScreenLabel: string;
  audioMuted: boolean;
  onAudioMutedChange: (muted: boolean) => void;
  onReplayIntroduction:()=>void;
  onClose: () => void;
}) {
  const {language}=useLocalization();
  const [selectedId, setSelectedId] = useState<SilverHelpTopicId>('getting-started');
  const [rate, setRate] = useState<'normal' | 'slow'>('normal');
  const [status, setStatus] = useState<SilverHelpNarrationStatus>('idle');
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const narrationAttemptRef=useRef(0);
  const topics=language==='tr'?SILVER_HELP_TOPICS:SILVER_HELP_TOPICS_EN;
  const selected = topics.find((topic) => topic.id === selectedId) ?? topics[0]!;
  const text = useMemo(() => silverHelpNarrationText(selected, activeScreenLabel,language), [activeScreenLabel,language,selected]);

  const stop = () => {
    narrationAttemptRef.current+=1;
    try { speechSynthesis()?.cancel(); } catch { /* Metin her durumda görünür kalır. */ }
    setStatus('idle');
  };
  const speak = async() => {
    if (audioMuted) onAudioMutedChange(false);
    const synthesis=speechSynthesis();
    const attempt=++narrationAttemptRef.current;
    const preferredVoice=await waitForPreferredNarrationVoice(synthesis,language);
    if(attempt!==narrationAttemptRef.current)return;
    startSilverHelpNarration({
      text,
      language,
      rate,
      synthesis,
      ...(preferredVoice?{preferredVoice}:{}),
      requirePreferredVoice:true,
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
        <div><span className="eyebrow">{language==='tr'?'Silver erişilebilirlik hazırlığı':'Silver accessibility readiness'}</span><h2 id="narrated-help-title">{language==='tr'?'Sesli Yardım Merkezi':'Narrated Help Center'}</h2><p id="narrated-help-description">{language==='tr'?'İstediğiniz konuyu seçin; açıklamayı okuyun veya Türkçe olarak dinleyin.':'Select a topic, read the explanation or listen to it in English.'}</p></div>
        <button type="button" className="narrated-help-close" autoFocus aria-label={language==='tr'?'Yardım Merkezini kapat':'Close Help Center'} onClick={onClose}>×</button>
      </header>
      <div className="narrated-help-layout">
        <nav aria-label={language==='tr'?'Yardım konuları':'Help topics'}>
          {topics.map((topic) => <button type="button" key={topic.id} aria-current={selected.id === topic.id ? 'page' : undefined} onClick={() => { stop(); setSelectedId(topic.id); }}><strong>{topic.title}</strong><span>{topic.summary}</span></button>)}
        </nav>
        <article aria-live="polite">
          <span className="eyebrow">{selected.title}</span>
          <h3>{selected.id === 'current-screen' ? language==='tr'?`${activeScreenLabel} bölümü`:`${activeScreenLabel} section` : selected.title}</h3>
          <p>{text}</p>
          <div className="narrated-help-controls">
            <button type="button" className="primary" onClick={()=>void speak()}>{status === 'speaking' ? (language==='tr'?'Baştan anlat':'Play again') : audioMuted ? (language==='tr'?'Sesi aç ve anlat':'Turn on audio and narrate') : (language==='tr'?'Sesli anlat':'Narrate')}</button>
            <button type="button" disabled={status !== 'speaking'} onClick={stop}>{language==='tr'?'Durdur':'Stop'}</button>
            <button type="button" aria-pressed={rate === 'slow'} onClick={() => { stop(); setRate((value) => value === 'normal' ? 'slow' : 'normal'); }}>{rate === 'slow' ? (language==='tr'?'Normal hız':'Normal speed') : (language==='tr'?'Daha yavaş':'Slower')}</button>
            <button type="button" aria-pressed={audioMuted} onClick={() => { stop(); onAudioMutedChange(!audioMuted); }}>{audioMuted ? (language==='tr'?'Sesi aç':'Turn sound on') : (language==='tr'?'Sesi kapat':'Turn sound off')}</button>
            <button type="button" onClick={()=>{stop();onReplayIntroduction();}}>{language==='tr'?'Uygulama tanıtımını yeniden aç':'Replay application introduction'}</button>
          </div>
          <small role="status">{language==='tr'?narrationStatusText[status]:({idle:'Select a topic to listen.',speaking:'Voice narration is playing.',ready:'Narration completed.',unavailable:'Voice narration is unavailable on this device; you can read the text on screen.',error:'Voice narration could not be started; the text remains visible.'} as const)[status]}</small>
        </article>
      </div>
      <footer><span>{language==='tr'?'F1 ile açılır':'Press F1 to open'}</span><span>{language==='tr'?'Esc ile kapanır':'Press Esc to close'}</span><span>{language==='tr'?'Metin her zaman görünür kalır':'Text always remains visible'}</span></footer>
    </section>
  </div>;
}
