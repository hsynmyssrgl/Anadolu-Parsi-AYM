import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FamilyMemberView,
  LongTermPortfolioAllocationInput,
  LongTermPortfolioAssetClass,
  LongTermPortfolioInstrumentRevisionView,
  LongTermPortfolioLedgerEventType,
  LongTermPortfolioLedgerEventView,
  LongTermPortfolioWorkspaceView,
  RecordLongTermPortfolioItemInput
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';

interface LongTermPortfolioPanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: LongTermPortfolioWorkspaceView | undefined;
  readonly onRecord: (input: RecordLongTermPortfolioItemInput) => Promise<void>;
}

type PanelMode = 'overview' | 'plan' | 'instruments' | 'transactions' | 'corporate-actions' | 'projections';
type WithoutClientOperationId<T> = T extends {readonly clientOperationId:string} ? Omit<T,'clientOperationId'> : never;
type RecordLongTermPortfolioItemDraft = WithoutClientOperationId<RecordLongTermPortfolioItemInput>;

const assetClassLabels: Record<LongTermPortfolioAssetClass,string> = {
  domestic_equity:'Yerli hisse', foreign_equity:'Yabancı hisse', fund:'Fon', etf:'ETF', bond_note:'Tahvil / bono',
  eurobond:'Eurobond', deposit:'Mevduat', foreign_currency:'Döviz', gold:'Altın', silver:'Gümüş', commodity:'Emtia',
  private_pension:'BES / emeklilik', ipo_reserve:'Halka arz rezervi', cash_savings:'Nakit / birikim',
  crypto_asset:'Kripto varlık', real_estate:'Gayrimenkul', vehicle:'Araç', custom:'Özel'
};

const eventLabels: Record<LongTermPortfolioLedgerEventType,string> = {
  buy:'Alım', sell:'Satım', cash_dividend:'Nakit temettü', rights_issue_used:'Bedelli hak kullanımı',
  rights_issue_sold:'Rüçhan hakkı satışı', rights_issue_expired:'Rüçhan hakkı süresi doldu', bonus_shares:'Bedelsiz pay',
  split:'Bölünme', reverse_split:'Ters bölünme', coupon:'Kupon', interest:'Faiz', fund_distribution:'Fon dağıtımı',
  merger_exchange:'Birleşme / değişim', code_change:'Kod değişimi', transfer_in:'Haricî kıymet virman girişi', transfer_out:'Kıymetler arası bütçe virmanı',
  fee:'Komisyon / masraf', tax:'Vergi', cash_adjustment:'Nakit düzeltme', reversal:'Ters kayıt'
};

const corporateEvents = new Set<LongTermPortfolioLedgerEventType>([
  'cash_dividend','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split',
  'coupon','interest','fund_distribution','merger_exchange','code_change'
]);

const localDateTime = ():string => {
  const date=new Date();
  return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16);
};
const localMonth = ():string => localDateTime().slice(0,7);
const monthAfter=(value:string):string=>{const date=new Date(`${value}-01T00:00:00.000Z`);date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,7);};
const toIso=(value:string):string=>new Date(value).toISOString();
const percentToBasisPoints=(value:string):number=>Math.round(Number(value)*100);
const basisPointsToPercent=(value:number):string=>(value/100).toString();
const formatMoney=(value:number|undefined,currency='TRY'):string=>value===undefined
  ? 'Hesaplanamadı'
  : `${value.toLocaleString('tr-TR',{maximumFractionDigits:2})} ${currency}`;
const formatDate=(value:string|undefined):string=>value
  ? new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))
  : '—';
const pendingOperationStorageKey='ppt.long-term-portfolio.pending-operation.v1';
const readPendingOperation=():{readonly key:string;readonly id:string}|undefined=>{try{const raw=localStorage.getItem(pendingOperationStorageKey);if(!raw)return undefined;const value=JSON.parse(raw) as {key?:unknown;id?:unknown};return typeof value.key==='string'&&typeof value.id==='string'?{key:value.key,id:value.id}:undefined;}catch{return undefined;}};
const storePendingOperation=(value:{readonly key:string;readonly id:string}|undefined):void=>{try{if(value)localStorage.setItem(pendingOperationStorageKey,JSON.stringify(value));else localStorage.removeItem(pendingOperationStorageKey);}catch{/* Storage erişilemezse aynı-render retry koruması çalışmaya devam eder. */}};

const defaultDirection=(eventType:LongTermPortfolioLedgerEventType):LongTermPortfolioLedgerEventView['direction']=>{
  if(eventType==='buy'||eventType==='rights_issue_used'||eventType==='fee'||eventType==='tax')return 'cash_out';
  if(eventType==='sell'||eventType==='cash_dividend'||eventType==='rights_issue_sold'||eventType==='coupon'||eventType==='interest'||eventType==='fund_distribution'||eventType==='cash_adjustment')return 'cash_in';
  if(eventType==='transfer_in'||eventType==='bonus_shares')return 'security_in';
  if(eventType==='rights_issue_expired')return 'security_out';
  return 'non_cash';
};

const chartPolyline=(values:readonly (number|undefined)[],width=760,height=180,scaleValues:readonly (number|undefined)[]=values):string=>{
  const numeric=scaleValues.filter((value):value is number=>value!==undefined&&Number.isFinite(value));
  if(numeric.length===0)return '';
  const maximum=Math.max(...numeric,1); const minimum=Math.min(...numeric,0); const range=Math.max(maximum-minimum,1);
  return values.map((value,index)=>{
    const x=values.length<=1?0:(index/(values.length-1))*width;
    const y=value===undefined?height:height-((value-minimum)/range)*height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

export function LongTermPortfolioPanel({people,workspace,onRecord}:LongTermPortfolioPanelProps){
  const [mode,setMode]=useState<PanelMode>('overview');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState<'success'|'danger'>('success');
  const [isRecording,setIsRecording]=useState(false);
  const recordingRef=useRef(false);
  const retryOperationRef=useRef<{readonly key:string;readonly id:string}|undefined>(readPendingOperation());
  const [ownerPersonId,setOwnerPersonId]=useState(people[0]?.id??'');

  const [effectiveMonth,setEffectiveMonth]=useState(localMonth);
  const [monthlyContribution,setMonthlyContribution]=useState('20000');
  const [changeReason,setChangeReason]=useState('Aylık birikim tutarı ve hedef dağılım güncellemesi');
  const [targetDate,setTargetDate]=useState('2032-08-13');
  const [rebalanceMonths,setRebalanceMonths]=useState('6');
  const [pessimisticReturn,setPessimisticReturn]=useState('5');
  const [baseReturn,setBaseReturn]=useState('15');
  const [optimisticReturn,setOptimisticReturn]=useState('25');
  const [inflation,setInflation]=useState('20');
  const [contributionGrowth,setContributionGrowth]=useState('20');
  const [allocationDraft,setAllocationDraft]=useState<LongTermPortfolioAllocationInput[]>([]);

  const [instrumentRevisionId,setInstrumentRevisionId]=useState('');
  const [instrumentClass,setInstrumentClass]=useState<LongTermPortfolioAssetClass>('domestic_equity');
  const [instrumentGroup,setInstrumentGroup]=useState('Hisse');
  const [instrumentCode,setInstrumentCode]=useState('');
  const [instrumentName,setInstrumentName]=useState('');
  const [instrumentCurrency,setInstrumentCurrency]=useState('TRY');
  const [instrumentStatus,setInstrumentStatus]=useState<LongTermPortfolioInstrumentRevisionView['status']>('active');
  const [instrumentIsin,setInstrumentIsin]=useState('');
  const [instrumentExchange,setInstrumentExchange]=useState('');
  const [instrumentPriceSource,setInstrumentPriceSource]=useState('Manuel kullanıcı girişi');
  const [instrumentTaxProfile,setInstrumentTaxProfile]=useState('');
  const [instrumentFeeProfile,setInstrumentFeeProfile]=useState('');
  const [instrumentNotes,setInstrumentNotes]=useState('');

  const [eventType,setEventType]=useState<LongTermPortfolioLedgerEventType>('buy');
  const [eventInstrumentId,setEventInstrumentId]=useState('');
  const [transferCounterpartyInstrumentId,setTransferCounterpartyInstrumentId]=useState('');
  const [orderAt,setOrderAt]=useState(localDateTime);
  const [executedAt,setExecutedAt]=useState(localDateTime);
  const [settlementAt,setSettlementAt]=useState(localDateTime);
  const [entitlementAt,setEntitlementAt]=useState('');
  const [recordAt,setRecordAt]=useState('');
  const [paymentAt,setPaymentAt]=useState('');
  const [eventQuantity,setEventQuantity]=useState('');
  const [unitPrice,setUnitPrice]=useState('');
  const [grossAmount,setGrossAmount]=useState('');
  const [feeAmount,setFeeAmount]=useState('0');
  const [taxAmount,setTaxAmount]=useState('0');
  const [eventCurrency,setEventCurrency]=useState('TRY');
  const [fxRate,setFxRate]=useState('');
  const [broker,setBroker]=useState('');
  const [accountReference,setAccountReference]=useState('');
  const [orderReference,setOrderReference]=useState('');
  const [executionReference,setExecutionReference]=useState('');
  const [partialFillSequence,setPartialFillSequence]=useState('');
  const [lotReference,setLotReference]=useState('');
  const [costLayerMethod,setCostLayerMethod]=useState<LongTermPortfolioLedgerEventView['costLayerMethod']>('weighted_average');
  const [corporateActionReference,setCorporateActionReference]=useState('');
  const [ratioNumerator,setRatioNumerator]=useState('');
  const [ratioDenominator,setRatioDenominator]=useState('');
  const [reversalOfEventId,setReversalOfEventId]=useState('');
  const [correctionReason,setCorrectionReason]=useState('');
  const [sourceLabel,setSourceLabel]=useState('Manuel kullanıcı kaydı');
  const [sourceDocumentReference,setSourceDocumentReference]=useState('');
  const [eventNotes,setEventNotes]=useState('');

  const [priceInstrumentId,setPriceInstrumentId]=useState('');
  const [priceAt,setPriceAt]=useState(localDateTime);
  const [priceValue,setPriceValue]=useState('');
  const [priceCurrency,setPriceCurrency]=useState('TRY');
  const [priceSource,setPriceSource]=useState('Manuel kullanıcı girişi');

  const currentInstruments=workspace?.currentInstruments??[];
  useEffect(()=>{
    const active=workspace?.activePlan;
    if(!active)return;
    setEffectiveMonth(localMonth()>active.effectiveMonth?localMonth():monthAfter(active.effectiveMonth));
    setMonthlyContribution(String(active.monthlyContribution));
    setTargetDate(active.targetDate.slice(0,10));
    setRebalanceMonths(String(active.rebalanceIntervalMonths));
    setPessimisticReturn(basisPointsToPercent(active.assumptions.pessimisticAnnualReturnBasisPoints));
    setBaseReturn(basisPointsToPercent(active.assumptions.baseAnnualReturnBasisPoints));
    setOptimisticReturn(basisPointsToPercent(active.assumptions.optimisticAnnualReturnBasisPoints));
    setInflation(basisPointsToPercent(active.assumptions.annualInflationBasisPoints));
    setContributionGrowth(basisPointsToPercent(active.assumptions.annualContributionGrowthBasisPoints));
    setAllocationDraft(active.allocations.map(({instrumentId,sleeve,targetBasisPoints,displayOrder,note})=>({instrumentId,sleeve,targetBasisPoints,displayOrder,...(note?{note}:{})})));
  },[workspace?.activePlan?.id]);
  useEffect(()=>{
    if(!eventInstrumentId&&currentInstruments[0])setEventInstrumentId(currentInstruments[0].instrumentId);
    if(!priceInstrumentId&&currentInstruments[0])setPriceInstrumentId(currentInstruments[0].instrumentId);
  },[currentInstruments,eventInstrumentId,priceInstrumentId]);
  useEffect(()=>{const instrument=currentInstruments.find(item=>item.instrumentId===eventInstrumentId);setEventCurrency(instrument?.currency??workspace?.portfolio?.baseCurrency??'TRY');},[currentInstruments,eventInstrumentId,workspace?.portfolio?.baseCurrency]);
  useEffect(()=>{const instrument=currentInstruments.find(item=>item.instrumentId===priceInstrumentId);setPriceCurrency(instrument?.currency??workspace?.portfolio?.baseCurrency??'TRY');},[currentInstruments,priceInstrumentId,workspace?.portfolio?.baseCurrency]);
  useEffect(()=>{setEventType(mode==='corporate-actions'?'cash_dividend':'buy');},[mode]);

  const allocationTotal=allocationDraft.reduce((total,item)=>total+item.targetBasisPoints,0);
  const analytics=workspace?.analytics;
  const series=analytics?.monthlySeries??[];
  const latestBudgetMonth=analytics?.monthlyBudgetCarryovers.at(-1)?.month;
  const currentBudgetCarryovers=analytics?.monthlyBudgetCarryovers.filter(item=>item.month===latestBudgetMonth)??[];
  const principalLine=chartPolyline(series.map(point=>point.contributedAmount));
  const valueLine=chartPolyline(series.map(point=>point.marketValue));
  const cashFlowScale=series.flatMap(point=>[point.dividendCouponInterestAmount,point.feeAmount+point.taxAmount,point.carryoverAmount]);
  const incomeLine=chartPolyline(series.map(point=>point.dividendCouponInterestAmount),760,180,cashFlowScale);
  const costLine=chartPolyline(series.map(point=>point.feeAmount+point.taxAmount),760,180,cashFlowScale);
  const carryoverLine=chartPolyline(series.map(point=>point.carryoverAmount),760,180,cashFlowScale);
  const projectionPoints=workspace?.projections.find(item=>item.scenario==='base')?.points??[];
  const projectionLine=chartPolyline(projectionPoints.map(point=>point.nominalValue));

  const record=async(input:RecordLongTermPortfolioItemDraft,success:string)=>{
    if(recordingRef.current)return;recordingRef.current=true;setIsRecording(true);
    const key=JSON.stringify(input);const pending=retryOperationRef.current?.key===key?retryOperationRef.current:{key,id:crypto.randomUUID()};retryOperationRef.current=pending;storePendingOperation(pending);
    const command={...input,clientOperationId:pending.id} as RecordLongTermPortfolioItemInput;
    try{setMessage('');await onRecord(command);retryOperationRef.current=undefined;storePendingOperation(undefined);setMessageTone('success');setMessage(success);}
    catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Portföy kaydı eklenemedi.');}
    finally{recordingRef.current=false;setIsRecording(false);}
  };

  const bootstrap=()=>record({
    itemType:'bootstrap_default',ownerPersonId,portfolioName:'2032 Uzun Vadeli Birikim Portföyü',
    effectiveMonth,targetDate:new Date(`${targetDate}T00:00:00`).toISOString(),privacy:'private'
  },'20.000 TL başlangıç planı, ürün kataloğu ve %100 dağılım tek işlemde oluşturuldu.');

  const submitPlan=()=>{
    if(!workspace?.portfolio)return;
    void record({
      itemType:'plan_version',portfolioId:workspace.portfolio.id,effectiveMonth,monthlyContribution:Number(monthlyContribution),
      contributionCurrency:'TRY',contributionChangeReason:changeReason,rebalanceIntervalMonths:Number(rebalanceMonths),
      inflationAdjustment:'manual_realized_inflation',targetDate:new Date(`${targetDate}T00:00:00`).toISOString(),
      assumptions:{pessimisticAnnualReturnBasisPoints:percentToBasisPoints(pessimisticReturn),baseAnnualReturnBasisPoints:percentToBasisPoints(baseReturn),optimisticAnnualReturnBasisPoints:percentToBasisPoints(optimisticReturn),annualInflationBasisPoints:percentToBasisPoints(inflation),annualContributionGrowthBasisPoints:percentToBasisPoints(contributionGrowth)},allocations:allocationDraft
    },'Yeni aylık plan sürümü eklendi; önceki plan değiştirilmedi.');
  };

  const submitInstrument=()=>{
    const previous=currentInstruments.find(item=>item.revisionId===instrumentRevisionId);
    void record({
      itemType:'instrument_revision',...(previous?{instrumentId:previous.instrumentId,replacesRevisionId:previous.revisionId}:{}),
      assetClass:instrumentClass,groupLabel:instrumentGroup,code:instrumentCode.toLocaleUpperCase('tr-TR'),name:instrumentName,
      currency:instrumentCurrency.toLocaleUpperCase('tr-TR'),effectiveFrom:new Date().toISOString(),status:instrumentStatus,
      ...(instrumentIsin.trim()?{isin:instrumentIsin.trim().toLocaleUpperCase('tr-TR')}:{ }),
      ...(instrumentExchange.trim()?{exchange:instrumentExchange.trim()}:{ }),priceSource:instrumentPriceSource,
      ...(instrumentTaxProfile.trim()?{taxProfile:instrumentTaxProfile.trim()}:{ }),...(instrumentFeeProfile.trim()?{feeProfile:instrumentFeeProfile.trim()}:{ }),
      ...(instrumentNotes.trim()?{notes:instrumentNotes.trim()}:{ })
    },previous?'Enstrümanın yeni sürümü eklendi; geçmiş kod korunuyor.':'Yeni enstrüman kataloğa eklendi.');
  };

  const submitEvent=()=>{
    if(!workspace?.portfolio)return;
    const direction=defaultDirection(eventType); const gross=Number(grossAmount||'0'); const fees=Number(feeAmount||'0'); const taxes=Number(taxAmount||'0');
    const net=direction==='cash_out'?-(gross+fees+taxes):direction==='cash_in'?gross-fees-taxes:0;
    void record({
      itemType:'ledger_event',portfolioId:workspace.portfolio.id,...(eventInstrumentId?{instrumentId:eventInstrumentId}:{}),eventType,direction,currency:eventCurrency.toLocaleUpperCase('tr-TR'),
      ...(orderAt?{orderAt:toIso(orderAt)}:{}),executedAt:toIso(executedAt),...(settlementAt?{settlementAt:toIso(settlementAt)}:{}),
      ...(entitlementAt?{entitlementAt:toIso(entitlementAt)}:{}),...(recordAt?{recordAt:toIso(recordAt)}:{}),...(paymentAt?{paymentAt:toIso(paymentAt)}:{}),
      ...(eventQuantity&&eventType!=='transfer_out'?{quantity:Number(eventQuantity)}:{}),...(unitPrice?{unitPrice:Number(unitPrice)}:{}),grossAmount:gross,feeAmount:fees,taxAmount:taxes,netCashAmount:net,
      ...(fxRate?{fxRate:Number(fxRate)}:{}),...(broker.trim()?{broker:broker.trim()}:{ }),...(accountReference.trim()?{accountReference:accountReference.trim()}:{ }),
      ...(orderReference.trim()?{orderReference:orderReference.trim()}:{ }),...(executionReference.trim()?{executionReference:executionReference.trim()}:{ }),
      ...(partialFillSequence?{partialFillSequence:Number(partialFillSequence)}:{}),...(lotReference.trim()?{lotReference:lotReference.trim()}:{ }),
      ...(costLayerMethod?{costLayerMethod}:{}),...(corporateActionReference.trim()?{corporateActionReference:corporateActionReference.trim()}:{ }),
      ...(ratioNumerator?{ratioNumerator:Number(ratioNumerator)}:{}),...(ratioDenominator?{ratioDenominator:Number(ratioDenominator)}:{}),
      ...(['cash_dividend','coupon','interest','fund_distribution'].includes(eventType)&&eventInstrumentId?{cashCarryoverInstrumentId:eventInstrumentId}:{}),
      ...(eventType==='transfer_out'&&transferCounterpartyInstrumentId?{transferCounterpartyInstrumentId}:{}),
      ...(reversalOfEventId?{reversalOfEventId,correctionReason:correctionReason.trim()}:{ }),sourceLabel,
      ...(sourceDocumentReference.trim()?{sourceDocumentReference:sourceDocumentReference.trim()}:{ }),...(eventNotes.trim()?{notes:eventNotes.trim()}:{ })
    },`${eventLabels[eventType]} değişmez portföy defterine eklendi.`);
  };

  const submitPrice=()=>void record({itemType:'price_observation',instrumentId:priceInstrumentId,observedAt:toIso(priceAt),unitPrice:Number(priceValue),currency:priceCurrency.toLocaleUpperCase('tr-TR'),sourceLabel:priceSource},'Manuel fiyat gözlemi eklendi; canlı fiyat doğrulaması yapılmadı.');

  const selectInstrumentRevision=(revisionId:string)=>{
    setInstrumentRevisionId(revisionId); const item=currentInstruments.find(value=>value.revisionId===revisionId); if(!item)return;
    setInstrumentClass(item.assetClass);setInstrumentGroup(item.groupLabel);setInstrumentCode(item.code);setInstrumentName(item.name);setInstrumentCurrency(item.currency);setInstrumentStatus(item.status);setInstrumentIsin(item.isin??'');setInstrumentExchange(item.exchange??'');setInstrumentPriceSource(item.priceSource??'Manuel kullanıcı girişi');setInstrumentTaxProfile(item.taxProfile??'');setInstrumentFeeProfile(item.feeProfile??'');setInstrumentNotes(item.notes??'');
  };

  const addAllocation=()=>{const candidate=currentInstruments.find(item=>!allocationDraft.some(allocation=>allocation.instrumentId===item.instrumentId&&allocation.sleeve==='custom'));if(candidate)setAllocationDraft(items=>[...items,{instrumentId:candidate.instrumentId,sleeve:'custom',targetBasisPoints:0,displayOrder:items.length+1}]);};
  const updateAllocation=(index:number,patch:Partial<LongTermPortfolioAllocationInput>)=>setAllocationDraft(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item));

  return <section className="ltp-dashboard" aria-label="Uzun vadeli portföy merkezi">
    <Surface className="workspace-summary">
      <SectionHeader eyebrow="33-L · DEC-223 · LTP-001–008" title="Uzun Vadeli Portföy"/>
      <div className="ltp-boundary-note"><strong>Takip ve karar desteği; yatırım emri veya tavsiye değildir.</strong><br/><small>Canlı fiyat, getiri, vergi/hukuk doğruluğu ve 2032 sonucu garanti edilmez. Dış doğrulama yalnız kaynağı ayrıca işaretlenen kayıtlarda kabul edilir.</small></div>
      <nav className="ltp-tabs" aria-label="Uzun vadeli portföy bölümleri">
        {([['overview','Genel bakış'],['plan','Aylık plan'],['instruments','Ürün kataloğu'],['transactions','Alım / satım'],['corporate-actions','Temettü ve haklar'],['projections','Grafik ve 2032']] as const).map(([value,label])=><Button key={value} tone={mode===value?'primary':'default'} onClick={()=>setMode(value)}>{label}</Button>)}
      </nav>
      {isRecording&&<StatusMessage>Portföy işlemi kaydediliyor; yinelenen gönderimler engellendi.</StatusMessage>}
      {message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}
      {analytics?.aggregateValuationStatus==='mixed_currency_requires_fx'&&<StatusMessage tone="danger">Baz kura çevrilmemiş {analytics.excludedCurrencyInstrumentIds.length} yabancı para pozisyonu bulunduğu için portföy toplamı ve birleşik grafik güvenli biçimde hesaplanmadı; kıymet bazındaki tutarlar kendi para biriminde gösterilir.</StatusMessage>}
      {analytics?.aggregateValuationStatus==='missing_prices'&&<StatusMessage>Güncel manuel fiyatı eksik {analytics.missingPriceInstrumentIds.length} aktif kıymet bulunduğu için toplam piyasa değeri hesaplanmadı.</StatusMessage>}
      {(analytics?.missingFxEventIds.length??0)>0&&<StatusMessage tone="danger">{analytics?.missingFxEventIds.length} yabancı para işleminde baz kur eksik; ilgili aylık kıymet devri hesaplanmadı.</StatusMessage>}
      {mode==='plan'&&<StatusMessage>Yeni sürüm son geçerlilik ayından ileri olmalıdır. Ocak planında aylık katkı, girilen gerçekleşmiş yıllık enflasyon tabanının altına düşemez.</StatusMessage>}
      {mode==='projections'&&workspace?.projections[0]&&<StatusMessage>Projeksiyon başlangıcı: {formatMoney(workspace.projections[0].startingValue,workspace.activePlan?.contributionCurrency)} · {workspace.projections[0].startingValueSource==='current_market_value'?'manuel fiyatlarla güncel değer':workspace.projections[0].startingValueSource==='contributed_principal'?'fiyat eksikken yatırılan anapara':'baz para toplamı hesaplanamadığı için sıfır taban'}. Sonuç yalnız senaryodur.</StatusMessage>}
      {(mode==='transactions'||mode==='corporate-actions')&&eventType==='transfer_out'&&<><label>Bütçe virman hedefi<select value={transferCounterpartyInstrumentId} onChange={event=>setTransferCounterpartyInstrumentId(event.target.value)}><option value="">Farklı kıymeti seçin</option>{currentInstruments.filter(item=>item.instrumentId!==eventInstrumentId&&item.currency===eventCurrency).map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><StatusMessage>Bu tek atomik kayıt yalnız aylık/devreden bütçeyi kaynak kıymetten hedef kıymete taşır; kıymet adedi üretmez veya eksiltmez.</StatusMessage></>}
    </Surface>

    {!workspace?.portfolio&&<Surface className="workspace-summary"><SectionHeader eyebrow="Kullanıcının başlangıç dağılımı" title="Portföyü tek işlemle kur"/><div className="ltp-empty-action"><label>Portföy sahibi<select value={ownerPersonId} onChange={event=>setOwnerPersonId(event.target.value)}><option value="">Seçin</option>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label>Başlangıç ayı<input type="month" value={effectiveMonth} onChange={event=>setEffectiveMonth(event.target.value)}/></label><label>Hedef tarihi<input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label><Button tone="primary" disabled={!ownerPersonId} onClick={()=>void bootstrap()}>20.000 TL planı ve kataloğu oluştur</Button></div><small>ASELS, TUPRS, THYAO, KCHOL, BIMAS, AKBNK, EREGL, BETAE, NETCD, TI2, AFT, TTE, KZL, GUF ve PPN; halka arz rezervi uygun ürüne kadar PPN’de tutulur.</small></Surface>}

    {mode==='overview'&&<>
      <div className="ltp-metric-grid">
        <div className="ltp-metric"><small>Toplam yatırılan</small><strong>{formatMoney(analytics?.totalContributed,analytics?.currency)}</strong><span>{workspace?.ledgerEvents.length??0} defter olayı</span></div>
        <div className="ltp-metric"><small>Güncel değer</small><strong>{formatMoney(analytics?.marketValue,analytics?.currency)}</strong><span>{analytics?.missingPriceInstrumentIds.length??0} eksik fiyat</span></div>
        <div className="ltp-metric"><small>Net kâr / zarar</small><strong>{formatMoney(analytics?.netProfitLoss,analytics?.currency)}</strong><span>Masraf {formatMoney(analytics?.totalFees,analytics?.currency)} · Vergi {formatMoney(analytics?.totalTaxes,analytics?.currency)}</span></div>
        <div className="ltp-metric"><small>Temettü / kupon / faiz</small><strong>{formatMoney(analytics?.totalIncome,analytics?.currency)}</strong><span>Sonraki aya aynı kıymette kalan {formatMoney(analytics?.totalCarryover,analytics?.currency)}</span></div>
      </div>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Aylık gerçekleşme" title="Anapara ve güncel değer"/>{series.length===0?<EmptyState title="Grafik için hareket yok" body="Alım, gelir ve manuel fiyat gözlemleri eklendikçe aylık seri oluşur."/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label="Anapara ve portföy değeri zaman serisi"><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-principal" points={principalLine}/><polyline className="ltp-chart-value" points={valueLine}/></svg><div className="ltp-chart-legend">Mavi: yatırılan anapara · Yeşil: manuel fiyatlarla hesaplanabilen güncel değer</div></div>}</Surface>
      <section className="workspace-grid"><Surface className="workspace-summary"><SectionHeader eyebrow="Hedef / gerçekleşen" title={analytics?.rebalanceDue?'6 aylık dengeleme kontrolü gerekli':'Dağılım görünümü'}/>{(analytics?.allocationDrift.length??0)===0?<EmptyState title="Dağılım hesaplanamadı" body="Etkin plan ve güncel fiyatlar bulunduğunda hedef sapmaları gösterilir."/>:analytics?.allocationDrift.map(item=><div className="ltp-allocation-row" key={item.allocationId}><span><strong>{item.code}</strong><br/><small>Hedef %{(item.targetBasisPoints/100).toLocaleString('tr-TR')}</small></span><span className="ltp-allocation-track"><span className="ltp-allocation-fill" style={{width:`${Math.min(100,item.actualBasisPoints===undefined?0:item.actualBasisPoints/100)}%`}}/></span><span className={item.rebalanceDue?'ltp-drift-warning':''}>{item.actualBasisPoints===undefined?'Fiyat eksik':`Gerçekleşen %${(item.actualBasisPoints/100).toLocaleString('tr-TR',{maximumFractionDigits:2})}`}</span></div>)}</Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Kıymet bazında" title={`${analytics?.positions.length??0} pozisyon`}/>{(analytics?.positions.length??0)===0?<EmptyState title="Pozisyon yok" body="Her kıymetin adet, maliyet, gelir, masraf, vergi ve net sonucu burada izlenir."/>:analytics?.positions.map(position=><div className="context-stat" key={position.instrumentId}><strong>{position.code} · {position.name}</strong><span>{position.quantity.toLocaleString('tr-TR',{maximumFractionDigits:6})} adet · Değer {formatMoney(position.marketValue,position.currency)} · Net {formatMoney(position.netProfitLoss,position.currency)}</span><small>Yatırılan {formatMoney(position.contributedAmount,position.currency)} · Gelir {formatMoney(position.incomeAmount,position.currency)} · Masraf/vergi {formatMoney(position.feeAmount+position.taxAmount,position.currency)} · Devreden {formatMoney(position.carryoverAmount,position.currency)}</small></div>)}</Surface></section>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Aynı kıymete otomatik devreden aylık bütçe" title={latestBudgetMonth??'Aylık plan bekleniyor'}/>{currentBudgetCarryovers.length===0?<EmptyState title="Aylık bütçe devri yok" body="Etkin plan oluştuğunda her kıymetin planlanan, alınan ve sonraki aya kalan tutarı burada hesaplanır."/>:<div style={{overflowX:'auto'}}><table className="ltp-ledger-table"><thead><tr><th>Kıymet</th><th>Planlanan</th><th>Açılış devri</th><th>Gerçekleşen alım</th><th>Yeniden yatırılacak gelir</th><th>Açık virman</th><th>Sonraki aya devir</th></tr></thead><tbody>{currentBudgetCarryovers.map(item=><tr key={`${item.month}-${item.instrumentId}`}><td>{item.code}</td><td>{formatMoney(item.plannedAmount,item.currency)}</td><td>{formatMoney(item.openingCarryoverAmount,item.currency)}</td><td>{formatMoney(item.actualContributionAmount,item.currency)}</td><td>{formatMoney(item.reinvestedIncomeAmount,item.currency)}</td><td>{formatMoney(item.explicitTransferNetAmount,item.currency)}</td><td>{item.complete?formatMoney(item.closingCarryoverAmount,item.currency):'Kur eksik'}</td></tr>)}</tbody></table></div>}</Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Ağırlıklı ortalama maliyet katmanı" title="Kıymet bazında maliyet ve gerçekleşen sonuç"/>{(analytics?.positions.length??0)===0?<EmptyState title="Maliyet hesabı için işlem yok" body="Alım, satım ve hak olayları geldikçe maliyet katmanı hesaplanır."/>:analytics?.positions.map(position=><div className="context-stat" key={`cost-${position.instrumentId}`}><strong>{position.code} · {position.costBasisStatus==='calculated_weighted_average'?'hesaplandı':position.costBasisStatus==='unsupported_cost_layer'?'FIFO/belirli lot ayrıca mutabakat ister':'geçmiş eksik'}</strong><span>Alış brüt {formatMoney(position.grossPurchaseAmount,position.currency)} · Satış brüt {formatMoney(position.grossSaleAmount,position.currency)} · Kalan maliyet {formatMoney(position.costBasisAmount,position.currency)} · Ortalama {formatMoney(position.averageUnitCost,position.currency)}</span><small>Gerçekleşen sonuç {formatMoney(position.realizedProfitLoss,position.currency)} · Gerçekleşmemiş sonuç {formatMoney(position.unrealizedProfitLoss,position.currency)} · Toplam net {formatMoney(position.netProfitLoss,position.currency)}</small></div>)}</Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Aylık gelir · gider · aynı kıymete devir" title="Nakit akışı grafiği"/>{series.length===0?<EmptyState title="Nakit akışı grafiği için veri yok" body="Aylık alım, gelir, masraf, vergi ve devreden bütçe oluştuğunda seri görünür."/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label="Aylık gelir masraf vergi ve aynı kıymete devreden bütçe"><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-income" points={incomeLine}/><polyline className="ltp-chart-cost" points={costLine}/><polyline className="ltp-chart-carryover" points={carryoverLine}/></svg><div className="ltp-chart-legend">Yeşil: temettü/kupon/faiz · Kırmızı: masraf+vergi · Mor: sonraki aya aynı kıymette devreden bütçe</div></div>}</Surface>
    </>}

    {mode==='plan'&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Öncekini silmez · yeni sürüm" title="Aylık plan ve varsayımlar"/><div className="ltp-form-grid"><label>Geçerli olacağı ay<input type="month" value={effectiveMonth} onChange={event=>setEffectiveMonth(event.target.value)}/></label><label>Aylık yatırım tutarı<input type="number" min="0.01" step="0.01" value={monthlyContribution} onChange={event=>setMonthlyContribution(event.target.value)}/></label><label className="span-2">Değişiklik nedeni<input maxLength={240} value={changeReason} onChange={event=>setChangeReason(event.target.value)}/></label><label>Yeniden dengeleme (ay)<input type="number" min="1" max="60" value={rebalanceMonths} onChange={event=>setRebalanceMonths(event.target.value)}/></label><label>Hedef tarihi<input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label><label>Kötümser yıllık getiri (%)<input type="number" step="0.01" value={pessimisticReturn} onChange={event=>setPessimisticReturn(event.target.value)}/></label><label>Temel yıllık getiri (%)<input type="number" step="0.01" value={baseReturn} onChange={event=>setBaseReturn(event.target.value)}/></label><label>İyimser yıllık getiri (%)<input type="number" step="0.01" value={optimisticReturn} onChange={event=>setOptimisticReturn(event.target.value)}/></label><label>Yıllık enflasyon (%)<input type="number" step="0.01" value={inflation} onChange={event=>setInflation(event.target.value)}/></label><label>Yıllık katkı artışı (%)<input type="number" step="0.01" value={contributionGrowth} onChange={event=>setContributionGrowth(event.target.value)}/></label></div><div className="notes-card"><strong>Dağılım toplamı %{(allocationTotal/100).toLocaleString('tr-TR',{maximumFractionDigits:2})}</strong><small>Aylık kıymet bakiyesi aynı kıymete devreder; başka kıymete geçiş yalnız açık virman kaydıyla yapılır.</small></div>{allocationDraft.map((item,index)=><div className="ltp-allocation-row" key={`${item.instrumentId}-${item.sleeve}-${index}`}><select value={item.instrumentId} onChange={event=>updateAllocation(index,{instrumentId:event.target.value})}>{currentInstruments.map(instrument=><option key={instrument.instrumentId} value={instrument.instrumentId}>{instrument.code} · {instrument.name}</option>)}</select><input aria-label="Hedef oran yüzde" type="number" min="0" max="100" step="0.01" value={item.targetBasisPoints/100} onChange={event=>updateAllocation(index,{targetBasisPoints:percentToBasisPoints(event.target.value)})}/><select value={item.sleeve} onChange={event=>updateAllocation(index,{sleeve:event.target.value as LongTermPortfolioAllocationInput['sleeve']})}><option value="core">Çekirdek</option><option value="growth">Büyüme</option><option value="opportunity">Fırsat</option><option value="ipo_reserve">Halka arz rezervi</option><option value="liquidity">Likidite</option><option value="hedge">Koruma</option><option value="custom">Özel</option></select></div>)}<Button onClick={addAllocation}>Dağılım satırı ekle</Button><Button tone="primary" disabled={!workspace?.portfolio||allocationTotal!==10000||!monthlyContribution||!effectiveMonth} onClick={submitPlan}>Yeni plan sürümünü kaydet</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Sürüm geçmişi" title={`${workspace?.planVersions.length??0} plan`}/>{workspace?.planVersions.map(plan=><div className="context-stat" key={plan.id}><strong>v{plan.version} · {plan.effectiveMonth} · {formatMoney(plan.monthlyContribution,plan.contributionCurrency)}</strong><span>{plan.allocations.length} dağılım · {plan.rebalanceIntervalMonths} ayda bir dengeleme · {plan.contributionChangeReason}</span><small>Oluşturma {formatDate(plan.createdAt)} · Önceki sürüm değiştirilmedi</small></div>)}</Surface></section>}

    {mode==='instruments'&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Stable ID · sürümlü kod" title="Yatırım ürünü ekle veya yeni sürüm oluştur"/><label>İşlem<select value={instrumentRevisionId} onChange={event=>selectInstrumentRevision(event.target.value)}><option value="">Yeni ürün</option>{currentInstruments.map(item=><option key={item.revisionId} value={item.revisionId}>{item.code} · yeni sürüm</option>)}</select></label><div className="ltp-form-grid"><label>Başlık<select value={instrumentClass} onChange={event=>setInstrumentClass(event.target.value as LongTermPortfolioAssetClass)}>{Object.entries(assetClassLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Grup<input maxLength={80} value={instrumentGroup} onChange={event=>setInstrumentGroup(event.target.value)}/></label><label>Kod<input maxLength={32} value={instrumentCode} onChange={event=>setInstrumentCode(event.target.value)}/></label><label>Ad<input maxLength={180} value={instrumentName} onChange={event=>setInstrumentName(event.target.value)}/></label><label>Para birimi<input maxLength={3} value={instrumentCurrency} onChange={event=>setInstrumentCurrency(event.target.value)}/></label><label>Durum<select value={instrumentStatus} onChange={event=>setInstrumentStatus(event.target.value as LongTermPortfolioInstrumentRevisionView['status'])}><option value="active">Aktif</option><option value="inactive">Pasif</option><option value="matured">Vadesi doldu</option><option value="merged">Birleşti</option></select></label><label>ISIN<input value={instrumentIsin} onChange={event=>setInstrumentIsin(event.target.value)}/></label><label>Borsa / piyasa<input value={instrumentExchange} onChange={event=>setInstrumentExchange(event.target.value)}/></label><label>Fiyat kaynağı<input value={instrumentPriceSource} onChange={event=>setInstrumentPriceSource(event.target.value)}/></label><label>Vergi profili<input value={instrumentTaxProfile} onChange={event=>setInstrumentTaxProfile(event.target.value)}/></label><label>Masraf profili<input value={instrumentFeeProfile} onChange={event=>setInstrumentFeeProfile(event.target.value)}/></label><label>Not<input value={instrumentNotes} onChange={event=>setInstrumentNotes(event.target.value)}/></label></div><Button tone="primary" disabled={instrumentCode.trim().length<1||instrumentName.trim().length<2} onClick={submitInstrument}>{instrumentRevisionId?'Yeni sürümü ekle':'Ürünü ekle'}</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Kod değişse de geçmiş kopmaz" title={`${currentInstruments.length} güncel ürün`}/>{currentInstruments.map(item=><div className="context-stat" key={item.instrumentId}><strong>{item.code} · {item.name}</strong><span>{assetClassLabels[item.assetClass]} · {item.currency} · {item.status}</span><small>{item.priceSource??'Fiyat kaynağı yok'} · Dış doğrulama: {item.externalVerification==='not_performed'?'yapılmadı':item.externalVerification}</small></div>)}</Surface></section>}

    {(mode==='transactions'||mode==='corporate-actions')&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Append-only · düzeltme ters kayıtla" title={mode==='transactions'?'Alım, satım, virman ve gider':'Temettü, bedelli, bedelsiz ve diğer haklar'}/><label>Olay türü<select value={eventType} onChange={event=>setEventType(event.target.value as LongTermPortfolioLedgerEventType)}>{Object.entries(eventLabels).filter(([value])=>mode==='corporate-actions'?corporateEvents.has(value as LongTermPortfolioLedgerEventType):!corporateEvents.has(value as LongTermPortfolioLedgerEventType)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Kıymet<select value={eventInstrumentId} onChange={event=>setEventInstrumentId(event.target.value)}><option value="">Nakit / portföy geneli</option>{currentInstruments.map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><div className="ltp-form-grid"><label>Sipariş tarihi/saati<input type="datetime-local" value={orderAt} onChange={event=>setOrderAt(event.target.value)}/></label><label>Gerçekleşme tarihi/saati<input type="datetime-local" value={executedAt} onChange={event=>setExecutedAt(event.target.value)}/></label><label>Takas / valör tarihi<input type="datetime-local" value={settlementAt} onChange={event=>setSettlementAt(event.target.value)}/></label><label>Hak kazanım tarihi<input type="datetime-local" value={entitlementAt} onChange={event=>setEntitlementAt(event.target.value)}/></label><label>Kayıt tarihi<input type="datetime-local" value={recordAt} onChange={event=>setRecordAt(event.target.value)}/></label><label>Ödeme tarihi<input type="datetime-local" value={paymentAt} onChange={event=>setPaymentAt(event.target.value)}/></label><label>Adet<input type="number" step="any" value={eventQuantity} onChange={event=>setEventQuantity(event.target.value)}/></label><label>Birim fiyat<input type="number" step="any" value={unitPrice} onChange={event=>setUnitPrice(event.target.value)}/></label><label>Brüt tutar<input type="number" min="0" step="0.01" value={grossAmount} onChange={event=>setGrossAmount(event.target.value)}/></label><label>Komisyon / masraf<input type="number" min="0" step="0.01" value={feeAmount} onChange={event=>setFeeAmount(event.target.value)}/></label><label>Vergi<input type="number" min="0" step="0.01" value={taxAmount} onChange={event=>setTaxAmount(event.target.value)}/></label><label>Para birimi<input maxLength={3} value={eventCurrency} onChange={event=>setEventCurrency(event.target.value)}/></label><label>Kur<input type="number" min="0" step="any" value={fxRate} onChange={event=>setFxRate(event.target.value)}/></label><label>Aracı kurum<input value={broker} onChange={event=>setBroker(event.target.value)}/></label><label>Hesap referansı<input value={accountReference} onChange={event=>setAccountReference(event.target.value)}/></label><label>Sipariş referansı<input value={orderReference} onChange={event=>setOrderReference(event.target.value)}/></label><label>Gerçekleşme referansı<input value={executionReference} onChange={event=>setExecutionReference(event.target.value)}/></label><label>Kısmi gerçekleşme sıra no<input type="number" min="1" step="1" value={partialFillSequence} onChange={event=>setPartialFillSequence(event.target.value)}/></label><label>Lot / maliyet katmanı<input value={lotReference} onChange={event=>setLotReference(event.target.value)}/></label><label>Maliyet yöntemi<select value={costLayerMethod} onChange={event=>setCostLayerMethod(event.target.value as LongTermPortfolioLedgerEventView['costLayerMethod'])}><option value="weighted_average">Ağırlıklı ortalama</option><option value="fifo">FIFO</option><option value="specific_lot">Belirli lot</option><option value="not_applicable">Uygulanmaz</option></select></label><label>Kurumsal işlem referansı<input value={corporateActionReference} onChange={event=>setCorporateActionReference(event.target.value)}/></label><label>Oran pay<input type="number" min="0" step="any" value={ratioNumerator} onChange={event=>setRatioNumerator(event.target.value)}/></label><label>Oran payda<input type="number" min="0" step="any" value={ratioDenominator} onChange={event=>setRatioDenominator(event.target.value)}/></label><label>Ters çevrilecek kayıt<select value={reversalOfEventId} onChange={event=>setReversalOfEventId(event.target.value)}><option value="">Ters kayıt değil</option>{workspace?.ledgerEvents.filter(item=>item.eventType!=='reversal').map(item=><option key={item.id} value={item.id}>{eventLabels[item.eventType]} · {formatDate(item.executedAt)}</option>)}</select></label><label>Düzeltme gerekçesi<input disabled={!reversalOfEventId} value={correctionReason} onChange={event=>setCorrectionReason(event.target.value)}/></label><label>Kaynak etiketi<input value={sourceLabel} onChange={event=>setSourceLabel(event.target.value)}/></label><label>Belge / dekont referansı<input value={sourceDocumentReference} onChange={event=>setSourceDocumentReference(event.target.value)}/></label><label className="span-2">Not<input value={eventNotes} onChange={event=>setEventNotes(event.target.value)}/></label></div><div className="notes-card"><strong>Hesaplanan net nakit: {formatMoney((()=>{const gross=Number(grossAmount||'0'),fee=Number(feeAmount||'0'),tax=Number(taxAmount||'0'),direction=defaultDirection(eventType);return direction==='cash_out'?-(gross+fee+tax):direction==='cash_in'?gross-fee-tax:0;})(),eventCurrency)}</strong><small>Kısmi gerçekleşmeler ayrı satırdır. Yanlış kayıt silinmez/değiştirilmez; yalnız referanslı ters kayıt eklenir.</small></div><Button tone="primary" disabled={!workspace?.portfolio||!executedAt||(eventType==='reversal'&&(!reversalOfEventId||correctionReason.trim().length<3))} onClick={submitEvent}>{eventLabels[eventType]} kaydet</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Tarih ve kaynak kanıtlı" title={`${workspace?.ledgerEvents.length??0} defter kaydı`}/>{(workspace?.ledgerEvents.length??0)===0?<EmptyState title="İşlem yok" body="Alım, satım veya kurumsal işlem kaydedildiğinde bütün tarih ve maliyet alanlarıyla burada görünür."/>:<div style={{overflowX:'auto'}}><table className="ltp-ledger-table"><thead><tr><th>İşlem</th><th>Kıymet</th><th>Sipariş</th><th>Gerçekleşme</th><th>Takas/ödeme</th><th>Adet</th><th>Brüt</th><th>Masraf+vergi</th><th>Kaynak</th></tr></thead><tbody>{workspace?.ledgerEvents.map(item=><tr key={item.id}><td>{eventLabels[item.eventType]}{item.partialFillSequence?` #${item.partialFillSequence}`:''}</td><td>{currentInstruments.find(value=>value.instrumentId===item.instrumentId)?.code??'Nakit'}</td><td>{formatDate(item.orderAt)}</td><td>{formatDate(item.executedAt)}</td><td>{formatDate(item.paymentAt??item.settlementAt)}</td><td>{item.quantity?.toLocaleString('tr-TR',{maximumFractionDigits:6})??'—'}</td><td>{formatMoney(item.grossAmount,item.currency)}</td><td>{formatMoney(item.feeAmount+item.taxAmount,item.currency)}</td><td>{item.sourceLabel}</td></tr>)}</tbody></table></div>}</Surface></section>}

    {mode==='projections'&&<><section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Manuel ve zaman damgalı" title="Fiyat gözlemi ekle"/><label>Kıymet<select value={priceInstrumentId} onChange={event=>setPriceInstrumentId(event.target.value)}><option value="">Seçin</option>{currentInstruments.map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><label>Gözlem zamanı<input type="datetime-local" value={priceAt} onChange={event=>setPriceAt(event.target.value)}/></label><label>Birim fiyat<input type="number" min="0.000001" step="any" value={priceValue} onChange={event=>setPriceValue(event.target.value)}/></label><label>Para birimi<input maxLength={3} value={priceCurrency} onChange={event=>setPriceCurrency(event.target.value)}/></label><label>Kaynak etiketi<input value={priceSource} onChange={event=>setPriceSource(event.target.value)}/></label><Button tone="primary" disabled={!priceInstrumentId||!priceValue||!priceAt} onClick={submitPrice}>Fiyatı kaydet</Button><small>Canlı piyasa bağlantısı veya fiyat teslim garantisi yoktur.</small></Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Kötümser · temel · iyimser" title="2032 nominal ve reel tahmin"/>{workspace?.projections.map(scenario=><div className="context-stat" key={scenario.scenario}><strong>{scenario.scenario==='pessimistic'?'Kötümser':scenario.scenario==='base'?'Temel':'İyimser'} · %{(scenario.annualReturnBasisPoints/100).toLocaleString('tr-TR')}</strong><span>Nominal {formatMoney(scenario.terminalNominalValue,workspace.activePlan?.contributionCurrency)} · Reel {formatMoney(scenario.terminalRealValue,workspace.activePlan?.contributionCurrency)}</span><small>Varsayım tabanlıdır; gerçekleşme veya getiri garantisi değildir.</small></div>)}</Surface></section><Surface className="workspace-summary"><SectionHeader eyebrow="Temel senaryo" title="Katkı ve tahmini gelecek değer"/>{projectionPoints.length===0?<EmptyState title="Projeksiyon yok" body="Etkin plan oluşturulduğunda düzenlenebilir varsayımlarla 2032 serisi hesaplanır."/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label="2032 temel senaryo nominal portföy tahmini"><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-projection" points={projectionLine}/></svg><div className="ltp-chart-legend">Kesikli turuncu: düzenlenebilir getiri, enflasyon ve katkı artışı varsayımlarıyla nominal temel senaryo</div></div>}</Surface></>}
  </section>;
}
