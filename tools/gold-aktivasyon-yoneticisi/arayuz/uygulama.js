const api = window.parsyuvaGold;
const elements = {
  genelDurum: document.querySelector('#genelDurum'), kasaAdimi: document.querySelector('#kasaAdimi'), guvenAdimi: document.querySelector('#guvenAdimi'),
  cihazAdimi: document.querySelector('#cihazAdimi'), kasaBilgisi: document.querySelector('#kasaBilgisi'), guvenBilgisi: document.querySelector('#guvenBilgisi'),
  cihazBilgisi: document.querySelector('#cihazBilgisi'), kasaHazirla: document.querySelector('#kasaHazirla'), guvenYapilandir: document.querySelector('#guvenYapilandir'),
  cihazSec: document.querySelector('#cihazSec'), form: document.querySelector('#aktivasyonFormu'), lisansKimligi: document.querySelector('#lisansKimligi'),
  kodUret: document.querySelector('#kodUret'), sonuc: document.querySelector('#sonuc'), sonucMetni: document.querySelector('#sonucMetni'),
  aktivasyonuKur: document.querySelector('#aktivasyonuKur'), hata: document.querySelector('#hata')
};
let bindingSessionId;

const setBusy = (busy) => {
  for (const button of [elements.kasaHazirla, elements.guvenYapilandir, elements.cihazSec, elements.kodUret, elements.aktivasyonuKur]) button.disabled = busy;
};
const showError = (error) => {
  elements.hata.textContent = error instanceof Error ? error.message : String(error);
  elements.hata.hidden = false;
};
const clearError = () => { elements.hata.hidden = true; elements.hata.textContent = ''; };
const applyStatus = (status) => {
  elements.kasaAdimi.classList.toggle('tamam', status.vaultReady);
  elements.guvenAdimi.classList.toggle('tamam', status.trustMatches);
  elements.kasaBilgisi.textContent = status.vaultReady
    ? `Hazır · Açık anahtar ${status.publicKeySha256.slice(0, 8)}…${status.publicKeySha256.slice(-8)}`
    : 'Windows korumalı imza kasası henüz oluşturulmadı.';
  elements.guvenBilgisi.textContent = status.trustMatches
    ? 'Ana uygulama bu üreticinin imzasını kabul edecek.'
    : status.trustProvisioned ? 'Yapılandırılmış anahtar bu kasayla eşleşmiyor.' : 'Ana uygulamanın açık güven anahtarı henüz yüklenmedi.';
  elements.genelDurum.textContent = status.vaultReady && status.trustMatches ? 'İMZA ZİNCİRİ HAZIR' : 'KURULUM GEREKİYOR';
  elements.genelDurum.classList.toggle('ready', status.vaultReady && status.trustMatches);
};
const action = async (operation) => {
  clearError(); setBusy(true);
  try { return await operation(); }
  catch (error) { showError(error); return undefined; }
  finally { setBusy(false); }
};

elements.kasaHazirla.addEventListener('click', () => void action(async () => applyStatus(await api.prepareVault())));
elements.guvenYapilandir.addEventListener('click', () => void action(async () => {
  const result = await api.provisionTrust();
  applyStatus(result.status);
}));
elements.cihazSec.addEventListener('click', () => void action(async () => {
  const result = await api.captureDeviceBinding();
  if (result.canceled) return;
  bindingSessionId = result.sessionId;
  elements.cihazAdimi.classList.add('tamam');
  elements.cihazBilgisi.textContent = `Doğrulandı · ${result.maskedBinding}`;
}));
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void action(async () => {
    if (!bindingSessionId) throw new Error('Önce hedef Gold uygulamasından cihaz bağını alın.');
    const result = await api.generateActivation({ sessionId: bindingSessionId, licenseId: elements.lisansKimligi.value.trim() });
    if (result.canceled) return;
    elements.sonucMetni.textContent = `${result.fileName} · ${result.licenseId} · İmza ve cihaz bağı doğrulandı.`;
    elements.sonuc.hidden = false;
  });
});
elements.aktivasyonuKur.addEventListener('click', () => void action(async () => {
  const result = await api.installActivation();
  elements.sonucMetni.textContent = `${result.licenseId} ana uygulamaya gönderildi. Ana uygulama imzayı doğrulayıp kapanacaktır.`;
}));

void action(async () => applyStatus(await api.getStatus()));
