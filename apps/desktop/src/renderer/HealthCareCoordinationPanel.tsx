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
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const measurementKinds = new Set<HealthCareEntryKind>([
  'blood_pressure','blood_glucose','weight','nutrition','hydration'
]);

interface PendingIdentity {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly grantId?: string;
}

export function HealthCareCoordinationPanel({ people }: { readonly people: readonly FamilyMemberView[] }) {
  const { language, locale }=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const entryLabels: ReadonlyArray<{ readonly value: HealthCareEntryKind; readonly label: string }> = [
    { value:'allergy',label:text('Alerji','Allergy') },{ value:'chronic_condition',label:text('Kronik durum','Chronic condition') },
    { value:'blood_type',label:text('Kan grubu','Blood type') },{ value:'vaccine',label:text('Aşı','Vaccine') },
    { value:'appointment',label:text('Randevu','Appointment') },{ value:'document_link',label:text('Sağlık belgesi bağlantısı','Health document link') },
    { value:'care_plan',label:text('Bakım planı','Care plan') },{ value:'care_task',label:text('Bakım görevi','Care task') },
    { value:'medication_confirmation',label:text('İlaç alım teyidi','Medication confirmation') },{ value:'transport',label:text('Ulaşım desteği','Transport support') },
    { value:'caregiver_shift',label:text('Bakım veren vardiyası','Caregiver shift') },{ value:'handover_note',label:text('Vardiya devir notu','Shift handover note') },
    { value:'blood_pressure',label:text('Tansiyon','Blood pressure') },{ value:'blood_glucose',label:text('Kan şekeri','Blood glucose') },
    { value:'weight',label:text('Kilo','Weight') },{ value:'nutrition',label:text('Beslenme','Nutrition') },
    { value:'hydration',label:text('Sıvı takibi','Hydration') },{ value:'wellbeing_check',label:text('İyi olma kontrolü','Wellbeing check') },
    { value:'help_request',label:text('Yardım isteği','Help request') },{ value:'fall_observation',label:text('Düşme gözlemi','Fall observation') },
    { value:'emergency_observation',label:text('Acil durum gözlemi','Emergency observation') },{ value:'contact_action',label:text('Tek dokunuşlu kişi arama kaydı','One-touch contact action record') }
  ];
  const scopeLabels: ReadonlyArray<{ readonly value: HealthCareAccessScope; readonly label: string }> = [
    { value:'emergency_summary',label:text('Acil özet','Emergency summary') },{ value:'care_plan',label:text('Bakım planı ve vardiya','Care plan and shifts') },
    { value:'medication',label:text('İlaç teyitleri','Medication confirmations') },{ value:'appointments',label:text('Randevu ve ulaşım','Appointments and transport') },
    { value:'measurements',label:text('Ölçümler','Measurements') },{ value:'check_ins',label:text('Kontrol ve yardım istekleri','Check-ins and help requests') },
    { value:'alerts',label:text('Düşme ve acil gözlemler','Fall and emergency observations') },{ value:'contacts',label:text('Kişi arama kayıtları','Contact action records') },
    { value:'documents',label:text('Belgeler ve aşılar','Documents and vaccines') }
  ];
  const entryLabel=(value:HealthCareEntryKind):string=>entryLabels.find((item)=>item.value===value)!.label;
  const statusLabels:Readonly<Record<HealthCareEntryStatus,string>>={
    active:text('Etkin','Active'),scheduled:text('Planlandı','Scheduled'),completed:text('Tamamlandı','Completed'),
    cancelled:text('İptal edildi','Canceled'),needs_help:text('Yardım gerekiyor','Needs help'),observed:text('Gözlendi','Observed'),not_performed:text('Yapılmadı','Not performed')
  };
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
  const [messageTone,setMessageTone]=useState<'success'|'warning'>('warning');
  const pending=useRef(new Map<string,PendingIdentity>());

  const reload=async(preferredOwner=ownerPersonId)=>{
    if(!window.pardus||!preferredOwner)return;
    setLoading(true);
    try{
      const next=await window.pardus.getHealthCareCoordinationCenter({ownerPersonId:preferredOwner});
      setCenter(next);setMessage('');
    }catch(error){setCenter(undefined);setMessageTone('warning');setMessage(toUserFacingErrorMessage(error,text('Bakım merkezi yüklenemedi.','Care center could not be loaded.')));}
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
      await reload();setMessageTone('success');setMessage(text('Yerel sağlık/bakım kaydı eklendi.','The local health/care record was added.'));
    }catch(error){setMessageTone('warning');setMessage(`${toUserFacingErrorMessage(error,text('Kayıt eklenemedi.','The record could not be added.'))} ${text('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.','You can retry with the same operation identifier and revision.')}`);}
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
      pending.current.delete(`grant:${caregiverAccountId}`);await reload();setMessageTone('success');setMessage(text('Minimum-gerekli bakım veren izni kaydedildi.','The minimum-necessary caregiver permission was recorded.'));
    }catch(error){setMessageTone('warning');setMessage(`${toUserFacingErrorMessage(error,text('İzin kaydedilemedi.','The permission could not be saved.'))} ${text('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.','You can retry with the same operation identifier and revision.')}`);}
    finally{setBusy(false);}
  };

  const revoke=async(grantId:string)=>{
    if(!window.pardus||busy)return;
    const operation=identity(`revoke:${grantId}`);setBusy(true);setMessage('');
    try{
      await window.pardus.revokeHealthCareAccessGrant({ownerPersonId,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,grantId});
      pending.current.delete(`revoke:${grantId}`);await reload();setMessageTone('success');setMessage(text('Bakım veren erişimi yerel olarak iptal edildi.','Caregiver access was revoked locally.'));
    }catch(error){setMessageTone('warning');setMessage(`${toUserFacingErrorMessage(error,text('İzin iptal edilemedi.','The permission could not be revoked.'))} ${text('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.','You can retry with the same operation identifier and revision.')}`);}
    finally{setBusy(false);}
  };

  const measurementRequired=measurementKinds.has(kind);
  const measurementReady=!measurementRequired||(measurementValue!==''&&measurementUnit.trim()!==''&&(kind!=='blood_pressure'||measurementSecondary!==''));
  return <Surface className={`health-care-coordination ${largeText?'health-care-large-text':''}`}>
    <SectionHeader eyebrow={text('Yerel ve yalnız gerekli bilgi','Local and minimum necessary')} title={text('Sağlık koordinasyonu ve yaşlı desteği','Health coordination and elder support')}/>
    <div className="health-care-truth" role="note">
      <strong>{text('Tıbbi doğrulama veya sağlık kayıt sistemi sorgusu yapılmaz.','Medical verification and health-record system queries are not performed.')}</strong>
      <span>{text('Sensör, uzaktan yardım, acil servis araması ve dış yardım teslimi yapılandırılmadı; bu ekran yalnız yerel kayıt ve görünüm sağlar.','Sensors, remote assistance, emergency-service calls and external assistance delivery are not configured; this screen provides local records and views only.')}</span>
    </div>
    <div className="button-row">
      <label>{text('Kayıt sahibi','Record owner')}<select value={ownerPersonId} onChange={(event)=>{pending.current.clear();setOwnerPersonId(event.target.value);}}>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <Button onClick={()=>void reload()}>{text('Yenile','Refresh')}</Button>
      <Button aria-pressed={largeText} onClick={()=>setLargeText((value)=>!value)}>{largeText?text('Standart yazı','Standard text'):text('Büyük yazı','Large text')}</Button>
    </div>
    {message&&<p className={messageTone==='success'?'success-text':'warning-text'} aria-live="polite">{message}</p>}
    {loading?<p aria-live="polite">{text('Bakım merkezi yükleniyor…','Loading care center…')}</p>:<>
      <div className="health-care-summary-grid">
        <div><strong>{center?.emergencySummary.allergies.length??0}</strong><span>{text('Alerji','Allergy')}</span></div>
        <div><strong>{center?.emergencySummary.chronicConditions.length??0}</strong><span>{text('Kronik durum','Chronic condition')}</span></div>
        <div><strong>{center?.emergencySummary.bloodType?.title??'—'}</strong><span>{text('Kan grubu','Blood type')}</span></div>
        <div><strong>{center?.emergencySummary.activeMedicationConfirmations.length??0}</strong><span>{text('İlaç teyidi','Medication confirmation')}</span></div>
      </div>
      <div className="content-grid two">
        <section className="health-care-form" aria-labelledby="health-care-record-title">
          <h3 id="health-care-record-title">{text('Yerel bakım kaydı','Local care record')}</h3>
          <label>{text('Tür','Type')}<select value={kind} onChange={(event)=>setKind(event.target.value as HealthCareEntryKind)}>{entryLabels.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>{text('Başlık','Title')}<input maxLength={160} value={title} onChange={(event)=>setTitle(event.target.value)}/></label>
          <label>{text('Durum','State')}<select value={status} onChange={(event)=>setStatus(event.target.value as HealthCareEntryStatus)}><option value="active">{text('Etkin','Active')}</option><option value="scheduled">{text('Planlandı','Scheduled')}</option><option value="completed">{text('Tamamlandı','Completed')}</option><option value="cancelled">{text('İptal edildi','Canceled')}</option><option value="needs_help">{text('Yardım gerekiyor','Needs help')}</option><option value="observed">{text('Gözlendi','Observed')}</option><option value="not_performed">{text('Yapılmadı','Not performed')}</option></select></label>
          <label>{text('Not','Note')}<textarea maxLength={4096} rows={3} value={note} onChange={(event)=>setNote(event.target.value)}/></label>
          {measurementRequired&&<div className="health-care-measurement"><label>{text('Değer','Value')}<input type="number" min="0" value={measurementValue} onChange={(event)=>setMeasurementValue(event.target.value)}/></label>{kind==='blood_pressure'&&<label>{text('İkinci değer','Second value')}<input type="number" min="0" value={measurementSecondary} onChange={(event)=>setMeasurementSecondary(event.target.value)}/></label>}<label>{text('Birim','Unit')}<input maxLength={32} value={measurementUnit} onChange={(event)=>setMeasurementUnit(event.target.value)} placeholder={kind==='blood_pressure'?'mmHg':text('birim','unit')}/></label></div>}
          <Button tone="primary" disabled={busy||!ownerPersonId||title.trim().length<2||!measurementReady} onClick={()=>void record()}>{text('Kaydı ekle','Add record')}</Button>
        </section>
        <section className="health-care-form" aria-labelledby="health-care-grant-title">
          <h3 id="health-care-grant-title">{text('Bakım veren minimum erişimi','Minimum caregiver access')}</h3>
          {accounts.length?<><label>{text('Bakım veren','Caregiver')}<select value={caregiverAccountId} onChange={(event)=>setCaregiverAccountId(event.target.value)}>{accounts.map((account)=><option key={account.id} value={account.id}>{account.displayName}</option>)}</select></label><fieldset><legend>{text('Görülebilecek kapsamlar','Visible scopes')}</legend><div className="health-care-scopes">{scopeLabels.map((scope)=><label key={scope.value}><input type="checkbox" checked={selectedScopes.includes(scope.value)} onChange={()=>toggleScope(scope.value)}/>{scope.label}</label>)}</div></fieldset><label><input type="checkbox" checked={caregiverCanRecord} onChange={(event)=>setCaregiverCanRecord(event.target.checked)}/> {text('Seçili kapsamlarda kayıt ekleyebilsin','Allow adding records in selected scopes')}</label><Button disabled={busy||!caregiverAccountId||selectedScopes.length===0} onClick={()=>void grant()}>{text('İzni kaydet','Save permission')}</Button></>:<EmptyState title={text('Etkin bakım veren hesabı yok','No active caregiver account')} body={text('Bakım veren rolündeki etkin hesaplar bulunduğunda minimum kapsam seçebilirsiniz.','You can select a minimum scope when active accounts with the caregiver role are available.')}/>}
        </section>
      </div>
      <section aria-labelledby="health-care-visible-title"><h3 id="health-care-visible-title">{text('Yetkiniz kapsamında görünen kayıtlar','Records visible within your authorization')}</h3>{center?.entries.length?center.entries.map((item)=><div className="list-row" key={item.id}><div><strong>{item.title}</strong><small>{entryLabel(item.kind)} · {statusLabels[item.status]} · {new Date(item.occurredAt).toLocaleString(locale)}</small>{item.note&&<span>{item.note}</span>}</div>{item.measurement&&<b>{item.measurement.value}{item.measurement.secondaryValue===undefined?'':` / ${item.measurement.secondaryValue}`} {item.measurement.unit}</b>}</div>):<EmptyState title={text('Görünür bakım kaydı yok','No visible care records')} body={text('Kayıtlar sahiplik ve minimum-gerekli bakım kapsamına göre filtrelenir.','Records are filtered by ownership and the minimum-necessary care scope.')}/>}</section>
      <section aria-labelledby="health-care-grants-title"><h3 id="health-care-grants-title">{text('Bakım veren izinleri','Caregiver permissions')}</h3>{center?.caregiverGrants.length?center.caregiverGrants.map((item)=><div className="list-row" key={item.id}><div><strong>{accounts.find((account)=>account.id===item.caregiverAccountId)?.displayName??item.caregiverAccountId}</strong><small>{item.allowedScopes.map((scope)=>scopeLabels.find((label)=>label.value===scope)?.label??scope).join(' · ')} · {item.actions.includes('record')?text('Okuma ve kayıt','Read and record'):text('Salt okuma','Read only')} · {item.state==='active'?text('Etkin','Active'):text('İptal edildi','Revoked')}</small></div>{item.state==='active'&&<Button tone="danger" disabled={busy} onClick={()=>void revoke(item.id)}>{text('İptal et','Revoke')}</Button>}</div>):<EmptyState title={text('Bakım veren izni yok','No caregiver permissions')} body={text('Genel sağlık verisi otomatik açılmaz; yalnız seçtiğiniz kapsamlar paylaşılır.','General health data is never opened automatically; only the scopes you select are shared.')}/>}</section>
    </>}
  </Surface>;
}
