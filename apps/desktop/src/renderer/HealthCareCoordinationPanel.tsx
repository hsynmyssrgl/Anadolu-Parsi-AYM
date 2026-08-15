import { useEffect, useRef, useState } from 'react';
import type {
  FamilyAccountView,
  FamilyMemberView,
  HealthCareAccessScope,
  HealthCareCoordinationCenterView,
  HealthCareEntryKind,
  HealthCareEntryStatus
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, Surface } from './ui';

const entryLabels: ReadonlyArray<{ readonly value: HealthCareEntryKind; readonly label: string }> = [
  { value:'allergy',label:'Alerji' },
  { value:'chronic_condition',label:'Kronik durum' },
  { value:'blood_type',label:'Kan grubu' },
  { value:'vaccine',label:'Aşı' },
  { value:'appointment',label:'Randevu' },
  { value:'document_link',label:'Sağlık belgesi bağlantısı' },
  { value:'care_plan',label:'Bakım planı' },
  { value:'care_task',label:'Bakım görevi' },
  { value:'medication_confirmation',label:'İlaç alım teyidi' },
  { value:'transport',label:'Ulaşım desteği' },
  { value:'caregiver_shift',label:'Bakım veren vardiyası' },
  { value:'handover_note',label:'Vardiya devir notu' },
  { value:'blood_pressure',label:'Tansiyon' },
  { value:'blood_glucose',label:'Kan şekeri' },
  { value:'weight',label:'Kilo' },
  { value:'nutrition',label:'Beslenme' },
  { value:'hydration',label:'Sıvı takibi' },
  { value:'wellbeing_check',label:'İyi olma kontrolü' },
  { value:'help_request',label:'Yardım isteği' },
  { value:'fall_observation',label:'Düşme gözlemi' },
  { value:'emergency_observation',label:'Acil durum gözlemi' },
  { value:'contact_action',label:'Tek dokunuşlu kişi arama kaydı' }
];
const scopeLabels: ReadonlyArray<{ readonly value: HealthCareAccessScope; readonly label: string }> = [
  { value:'emergency_summary',label:'Acil özet' },
  { value:'care_plan',label:'Bakım planı ve vardiya' },
  { value:'medication',label:'İlaç teyitleri' },
  { value:'appointments',label:'Randevu ve ulaşım' },
  { value:'measurements',label:'Ölçümler' },
  { value:'check_ins',label:'Kontrol ve yardım istekleri' },
  { value:'alerts',label:'Düşme ve acil gözlemler' },
  { value:'contacts',label:'Kişi arama kayıtları' },
  { value:'documents',label:'Belgeler ve aşılar' }
];
const measurementKinds = new Set<HealthCareEntryKind>([
  'blood_pressure','blood_glucose','weight','nutrition','hydration'
]);

interface PendingIdentity {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly grantId?: string;
}

export function HealthCareCoordinationPanel({ people }: { readonly people: readonly FamilyMemberView[] }) {
  const [ownerPersonId,setOwnerPersonId]=useState(people[0]?.id??'');
  const [center,setCenter]=useState<HealthCareCoordinationCenterView>();
  const [accounts,setAccounts]=useState<readonly FamilyAccountView[]>([]);
  const [caregiverAccountId,setCaregiverAccountId]=useState('');
  const [kind,setKind]=useState<HealthCareEntryKind>('wellbeing_check');
  const [status,setStatus]=useState<HealthCareEntryStatus>('completed');
  const [title,setTitle]=useState('');
  const [note,setNote]=useState('');
  const [measurementValue,setMeasurementValue]=useState('');
  const [measurementSecondary,setMeasurementSecondary]=useState('');
  const [measurementUnit,setMeasurementUnit]=useState('');
  const [selectedScopes,setSelectedScopes]=useState<readonly HealthCareAccessScope[]>(['appointments','measurements']);
  const [caregiverCanRecord,setCaregiverCanRecord]=useState(false);
  const [largeText,setLargeText]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const pending=useRef(new Map<string,PendingIdentity>());

  const reload=async(preferredOwner=ownerPersonId)=>{
    if(!window.pardus||!preferredOwner)return;
    setLoading(true);
    try{
      const next=await window.pardus.getHealthCareCoordinationCenter({ownerPersonId:preferredOwner});
      setCenter(next);setMessage('');
    }catch(error){setCenter(undefined);setMessage(error instanceof Error?error.message:'Bakım merkezi yüklenemedi.');}
    finally{setLoading(false);}
  };

  useEffect(()=>{void reload(ownerPersonId);},[ownerPersonId]);
  useEffect(()=>{
    if(!window.pardus)return;
    void window.pardus.listAccounts().then((values)=>{
      const caregivers=values.filter((account)=>account.role==='caregiver'&&account.status==='active');
      setAccounts(caregivers);setCaregiverAccountId((current)=>current||caregivers[0]?.id||'');
    }).catch(()=>setAccounts([]));
  },[]);

  const identity=(key:string,withGrant=false):PendingIdentity=>{
    const current=pending.current.get(key);
    if(current)return current;
    const created={
      clientOperationId:`health-care-operation:${globalThis.crypto.randomUUID()}`,
      expectedRevision:center?.revision??0,
      ...(withGrant?{grantId:`health-care-grant:${globalThis.crypto.randomUUID()}`}:{})
    };
    pending.current.set(key,created);return created;
  };

  const record=async()=>{
    if(!window.pardus||!ownerPersonId||title.trim().length<2||busy)return;
    const operation=identity('entry');setBusy(true);setMessage('');
    try{
      const measurement=measurementKinds.has(kind)?{
        value:Number(measurementValue),
        ...(kind==='blood_pressure'?{secondaryValue:Number(measurementSecondary)}:{}),
        unit:measurementUnit.trim()
      }:undefined;
      await window.pardus.recordHealthCareEntry({
        ownerPersonId,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,
        kind,title:title.normalize('NFKC').trim(),status,occurredAt:new Date().toISOString(),
        ...(note.trim()?{note:note.normalize('NFKC').trim()}:{}),...(measurement?{measurement}:{})
      });
      pending.current.delete('entry');setTitle('');setNote('');setMeasurementValue('');setMeasurementSecondary('');setMeasurementUnit('');
      await reload();setMessage('Yerel sağlık/bakım kaydı eklendi.');
    }catch(error){setMessage(`${error instanceof Error?error.message:'Kayıt eklenemedi.'} Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  const toggleScope=(scope:HealthCareAccessScope)=>setSelectedScopes((current)=>
    current.includes(scope)?current.filter((value)=>value!==scope):[...current,scope]);

  const grant=async()=>{
    if(!window.pardus||!caregiverAccountId||selectedScopes.length===0||busy)return;
    const operation=identity(`grant:${caregiverAccountId}`,true);setBusy(true);setMessage('');
    try{
      await window.pardus.upsertHealthCareAccessGrant({
        ownerPersonId,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,
        grantId:operation.grantId!,caregiverAccountId,allowedScopes:selectedScopes,
        actions:caregiverCanRecord?['read','record']:['read'],startsAt:new Date().toISOString()
      });
      pending.current.delete(`grant:${caregiverAccountId}`);await reload();setMessage('Minimum-gerekli bakım veren izni kaydedildi.');
    }catch(error){setMessage(`${error instanceof Error?error.message:'İzin kaydedilemedi.'} Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  const revoke=async(grantId:string)=>{
    if(!window.pardus||busy)return;
    const operation=identity(`revoke:${grantId}`);setBusy(true);setMessage('');
    try{
      await window.pardus.revokeHealthCareAccessGrant({ownerPersonId,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,grantId});
      pending.current.delete(`revoke:${grantId}`);await reload();setMessage('Bakım veren erişimi yerel olarak iptal edildi.');
    }catch(error){setMessage(`${error instanceof Error?error.message:'İzin iptal edilemedi.'} Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  const measurementRequired=measurementKinds.has(kind);
  const measurementReady=!measurementRequired||(measurementValue!==''&&measurementUnit.trim()!==''&&(kind!=='blood_pressure'||measurementSecondary!==''));
  return <Surface className={`health-care-coordination ${largeText?'health-care-large-text':''}`}>
    <SectionHeader eyebrow="33-S · yerel ve minimum-gerekli" title="Sağlık koordinasyonu ve yaşlı desteği"/>
    <div className="health-care-truth" role="note">
      <strong>Tıbbi doğrulama veya sağlık kayıt sistemi sorgusu yapılmaz.</strong>
      <span>Sensör, uzaktan yardım, acil servis araması ve dış yardım teslimi yapılandırılmadı; bu ekran yalnız yerel kayıt ve görünüm sağlar.</span>
    </div>
    <div className="button-row">
      <label>Kayıt sahibi<select value={ownerPersonId} onChange={(event)=>{pending.current.clear();setOwnerPersonId(event.target.value);}}>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <Button onClick={()=>void reload()}>Yenile</Button>
      <Button aria-pressed={largeText} onClick={()=>setLargeText((value)=>!value)}>{largeText?'Standart yazı':'Büyük yazı'}</Button>
    </div>
    {message&&<p className={message.includes('eklendi')||message.includes('kaydedildi')||message.includes('iptal edildi')?'success-text':'warning-text'} aria-live="polite">{message}</p>}
    {loading?<p aria-live="polite">Bakım merkezi yükleniyor…</p>:<>
      <div className="health-care-summary-grid">
        <div><strong>{center?.emergencySummary.allergies.length??0}</strong><span>Alerji</span></div>
        <div><strong>{center?.emergencySummary.chronicConditions.length??0}</strong><span>Kronik durum</span></div>
        <div><strong>{center?.emergencySummary.bloodType?.title??'—'}</strong><span>Kan grubu</span></div>
        <div><strong>{center?.emergencySummary.activeMedicationConfirmations.length??0}</strong><span>İlaç teyidi</span></div>
      </div>
      <div className="content-grid two">
        <section className="health-care-form" aria-labelledby="health-care-record-title">
          <h3 id="health-care-record-title">Yerel bakım kaydı</h3>
          <label>Tür<select value={kind} onChange={(event)=>setKind(event.target.value as HealthCareEntryKind)}>{entryLabels.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Başlık<input maxLength={160} value={title} onChange={(event)=>setTitle(event.target.value)}/></label>
          <label>Durum<select value={status} onChange={(event)=>setStatus(event.target.value as HealthCareEntryStatus)}><option value="active">Etkin</option><option value="scheduled">Planlandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal edildi</option><option value="needs_help">Yardım gerekiyor</option><option value="observed">Gözlendi</option><option value="not_performed">Yapılmadı</option></select></label>
          <label>Not<textarea maxLength={4096} rows={3} value={note} onChange={(event)=>setNote(event.target.value)}/></label>
          {measurementRequired&&<div className="health-care-measurement"><label>Değer<input type="number" min="0" value={measurementValue} onChange={(event)=>setMeasurementValue(event.target.value)}/></label>{kind==='blood_pressure'&&<label>İkinci değer<input type="number" min="0" value={measurementSecondary} onChange={(event)=>setMeasurementSecondary(event.target.value)}/></label>}<label>Birim<input maxLength={32} value={measurementUnit} onChange={(event)=>setMeasurementUnit(event.target.value)} placeholder={kind==='blood_pressure'?'mmHg':'birim'}/></label></div>}
          <Button tone="primary" disabled={busy||!ownerPersonId||title.trim().length<2||!measurementReady} onClick={()=>void record()}>Kaydı ekle</Button>
        </section>
        <section className="health-care-form" aria-labelledby="health-care-grant-title">
          <h3 id="health-care-grant-title">Bakım veren minimum erişimi</h3>
          {accounts.length?<><label>Bakım veren<select value={caregiverAccountId} onChange={(event)=>setCaregiverAccountId(event.target.value)}>{accounts.map((account)=><option key={account.id} value={account.id}>{account.displayName}</option>)}</select></label><fieldset><legend>Görülebilecek kapsamlar</legend><div className="health-care-scopes">{scopeLabels.map((scope)=><label key={scope.value}><input type="checkbox" checked={selectedScopes.includes(scope.value)} onChange={()=>toggleScope(scope.value)}/>{scope.label}</label>)}</div></fieldset><label><input type="checkbox" checked={caregiverCanRecord} onChange={(event)=>setCaregiverCanRecord(event.target.checked)}/> Seçili kapsamlarda kayıt ekleyebilsin</label><Button disabled={busy||!caregiverAccountId||selectedScopes.length===0} onClick={()=>void grant()}>İzni kaydet</Button></>:<EmptyState title="Etkin bakım veren hesabı yok" body="Bakım veren rolündeki etkin hesaplar bulunduğunda minimum kapsam seçebilirsiniz."/>}
        </section>
      </div>
      <section aria-labelledby="health-care-visible-title"><h3 id="health-care-visible-title">Yetkiniz kapsamında görünen kayıtlar</h3>{center?.entries.length?center.entries.map((item)=><div className="list-row" key={item.id}><div><strong>{item.title}</strong><small>{entryLabels.find((entryLabel)=>entryLabel.value===item.kind)?.label??item.kind} · {item.status} · {new Date(item.occurredAt).toLocaleString('tr-TR')}</small>{item.note&&<span>{item.note}</span>}</div>{item.measurement&&<b>{item.measurement.value}{item.measurement.secondaryValue===undefined?'':` / ${item.measurement.secondaryValue}`} {item.measurement.unit}</b>}</div>):<EmptyState title="Görünür bakım kaydı yok" body="Kayıtlar sahiplik ve minimum-gerekli bakım kapsamına göre filtrelenir."/>}</section>
      <section aria-labelledby="health-care-grants-title"><h3 id="health-care-grants-title">Bakım veren izinleri</h3>{center?.caregiverGrants.length?center.caregiverGrants.map((item)=><div className="list-row" key={item.id}><div><strong>{accounts.find((account)=>account.id===item.caregiverAccountId)?.displayName??item.caregiverAccountId}</strong><small>{item.allowedScopes.map((scope)=>scopeLabels.find((label)=>label.value===scope)?.label??scope).join(' · ')} · {item.actions.includes('record')?'Okuma ve kayıt':'Salt okuma'} · {item.state==='active'?'Etkin':'İptal edildi'}</small></div>{item.state==='active'&&<Button tone="danger" disabled={busy} onClick={()=>void revoke(item.id)}>İptal et</Button>}</div>):<EmptyState title="Bakım veren izni yok" body="Genel sağlık verisi otomatik açılmaz; yalnız seçtiğiniz kapsamlar paylaşılır."/>}</section>
    </>}
  </Surface>;
}
