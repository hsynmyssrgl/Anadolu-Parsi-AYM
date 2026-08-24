import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FamilyMemberView,
  LongTermPortfolioAllocationInput,
  LongTermPortfolioAssetClass,
  LongTermPortfolioExternalVerification,
  LongTermPortfolioInstrumentRevisionView,
  LongTermPortfolioLedgerEventType,
  LongTermPortfolioLedgerEventView,
  LongTermPortfolioWorkspaceView,
  RecordLongTermPortfolioItemInput
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

interface LongTermPortfolioPanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: LongTermPortfolioWorkspaceView | undefined;
  readonly onRecord: (input: RecordLongTermPortfolioItemInput) => Promise<void>;
}

type PanelMode = 'overview' | 'plan' | 'instruments' | 'transactions' | 'corporate-actions' | 'projections';
type WithoutClientOperationId<T> = T extends {readonly clientOperationId:string} ? Omit<T,'clientOperationId'> : never;
type RecordLongTermPortfolioItemDraft = WithoutClientOperationId<RecordLongTermPortfolioItemInput>;

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
const formatMoney=(value:number|undefined,currency:string,locale:string,unavailable:string):string=>value===undefined
  ? unavailable
  : `${value.toLocaleString(locale,{maximumFractionDigits:2})} ${currency}`;
const formatDate=(value:string|undefined,locale:string):string=>value
  ? new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value))
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
  const { language, locale }=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const externalVerificationLabels:Readonly<Record<LongTermPortfolioExternalVerification,string>>={
    not_performed:text('yapılmadı','not performed'),user_confirmed:text('kullanıcı doğruladı','user confirmed'),
    source_document_checked:text('kaynak belge kontrol edildi','source document checked')
  };
  const assetClassLabels: Record<LongTermPortfolioAssetClass,string> = {
    domestic_equity:text('Yerli hisse','Domestic equity'), foreign_equity:text('Yabancı hisse','Foreign equity'), fund:text('Fon','Fund'), etf:'ETF', bond_note:text('Tahvil / bono','Bond / note'),
    eurobond:'Eurobond', deposit:text('Mevduat','Deposit'), foreign_currency:text('Döviz','Foreign currency'), gold:text('Altın','Gold'), silver:text('Gümüş','Silver'), commodity:text('Emtia','Commodity'),
    private_pension:text('BES / emeklilik','Private pension'), ipo_reserve:text('Halka arz rezervi','IPO reserve'), cash_savings:text('Nakit / birikim','Cash / savings'),
    crypto_asset:text('Kripto varlık','Crypto asset'), real_estate:text('Gayrimenkul','Real estate'), vehicle:text('Araç','Vehicle'), custom:text('Özel','Custom')
  };
  const eventLabels: Record<LongTermPortfolioLedgerEventType,string> = {
    buy:text('Alım','Buy'), sell:text('Satım','Sell'), cash_dividend:text('Nakit temettü','Cash dividend'), rights_issue_used:text('Bedelli hak kullanımı','Rights issue used'),
    rights_issue_sold:text('Rüçhan hakkı satışı','Rights sold'), rights_issue_expired:text('Rüçhan hakkı süresi doldu','Rights expired'), bonus_shares:text('Bedelsiz pay','Bonus shares'),
    split:text('Bölünme','Split'), reverse_split:text('Ters bölünme','Reverse split'), coupon:text('Kupon','Coupon'), interest:text('Faiz','Interest'), fund_distribution:text('Fon dağıtımı','Fund distribution'),
    merger_exchange:text('Birleşme / değişim','Merger / exchange'), code_change:text('Kod değişimi','Code change'), transfer_in:text('Haricî kıymet virman girişi','External security transfer in'), transfer_out:text('Kıymetler arası bütçe virmanı','Budget transfer between instruments'),
    fee:text('Komisyon / masraf','Commission / fee'), tax:text('Vergi','Tax'), cash_adjustment:text('Nakit düzeltme','Cash adjustment'), reversal:text('Ters kayıt','Reversal')
  };
  const money=(value:number|undefined,currency=workspace?.portfolio?.baseCurrency??'TRY')=>formatMoney(value,currency,locale,text('Hesaplanamadı','Not calculated'));
  const date=(value:string|undefined)=>formatDate(value,locale);
  const [mode,setMode]=useState<PanelMode>('overview');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState<'success'|'danger'>('success');
  const [isRecording,setIsRecording]=useState(false);
  const recordingRef=useRef(false);
  const retryOperationRef=useRef<{readonly key:string;readonly id:string}|undefined>(readPendingOperation());
  const [ownerPersonId,setOwnerPersonId]=useState(people[0]?.id??'');

  const [effectiveMonth,setEffectiveMonth]=useState(localMonth);
  const [monthlyContribution,setMonthlyContribution]=useState('20000');
  const [changeReason,setChangeReason]=useState(text('Aylık birikim tutarı ve hedef dağılım güncellemesi','Monthly contribution and target allocation update'));
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
  const [instrumentGroup,setInstrumentGroup]=useState(text('Hisse','Equity'));
  const [instrumentCode,setInstrumentCode]=useState('');
  const [instrumentName,setInstrumentName]=useState('');
  const [instrumentCurrency,setInstrumentCurrency]=useState('TRY');
  const [instrumentStatus,setInstrumentStatus]=useState<LongTermPortfolioInstrumentRevisionView['status']>('active');
  const [instrumentIsin,setInstrumentIsin]=useState('');
  const [instrumentExchange,setInstrumentExchange]=useState('');
  const [instrumentPriceSource,setInstrumentPriceSource]=useState(text('Manuel kullanıcı girişi','Manual user input'));
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
  const [sourceLabel,setSourceLabel]=useState(text('Manuel kullanıcı kaydı','Manual user record'));
  const [sourceDocumentReference,setSourceDocumentReference]=useState('');
  const [eventNotes,setEventNotes]=useState('');

  const [priceInstrumentId,setPriceInstrumentId]=useState('');
  const [priceAt,setPriceAt]=useState(localDateTime);
  const [priceValue,setPriceValue]=useState('');
  const [priceCurrency,setPriceCurrency]=useState('TRY');
  const [priceSource,setPriceSource]=useState(text('Manuel kullanıcı girişi','Manual user input'));

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
    catch(error){setMessageTone('danger');setMessage(toUserFacingErrorMessage(error,text('Portföy kaydı eklenemedi.','The portfolio record could not be added.')));}
    finally{recordingRef.current=false;setIsRecording(false);}
  };

  const bootstrap=()=>record({
    itemType:'bootstrap_default',ownerPersonId,portfolioName:text('2032 Uzun Vadeli Birikim Portföyü','2032 Long-Term Savings Portfolio'),
    effectiveMonth,targetDate:new Date(`${targetDate}T00:00:00`).toISOString(),privacy:'private'
  },text('20.000 TL başlangıç planı, ürün kataloğu ve %100 dağılım tek işlemde oluşturuldu.','The TRY 20,000 starter plan, product catalog, and 100% allocation were created in one operation.'));

  const submitPlan=()=>{
    if(!workspace?.portfolio)return;
    void record({
      itemType:'plan_version',portfolioId:workspace.portfolio.id,effectiveMonth,monthlyContribution:Number(monthlyContribution),
      contributionCurrency:'TRY',contributionChangeReason:changeReason,rebalanceIntervalMonths:Number(rebalanceMonths),
      inflationAdjustment:'manual_realized_inflation',targetDate:new Date(`${targetDate}T00:00:00`).toISOString(),
      assumptions:{pessimisticAnnualReturnBasisPoints:percentToBasisPoints(pessimisticReturn),baseAnnualReturnBasisPoints:percentToBasisPoints(baseReturn),optimisticAnnualReturnBasisPoints:percentToBasisPoints(optimisticReturn),annualInflationBasisPoints:percentToBasisPoints(inflation),annualContributionGrowthBasisPoints:percentToBasisPoints(contributionGrowth)},allocations:allocationDraft
    },text('Yeni aylık plan sürümü eklendi; önceki plan değiştirilmedi.','A new monthly plan revision was added; the previous plan was not changed.'));
  };

  const submitInstrument=()=>{
    const previous=currentInstruments.find(item=>item.revisionId===instrumentRevisionId);
    void record({
      itemType:'instrument_revision',...(previous?{instrumentId:previous.instrumentId,replacesRevisionId:previous.revisionId}:{}),
      assetClass:instrumentClass,groupLabel:instrumentGroup,code:instrumentCode.toLocaleUpperCase(locale),name:instrumentName,
      currency:instrumentCurrency.toLocaleUpperCase(locale),effectiveFrom:new Date().toISOString(),status:instrumentStatus,
      ...(instrumentIsin.trim()?{isin:instrumentIsin.trim().toLocaleUpperCase(locale)}:{ }),
      ...(instrumentExchange.trim()?{exchange:instrumentExchange.trim()}:{ }),priceSource:instrumentPriceSource,
      ...(instrumentTaxProfile.trim()?{taxProfile:instrumentTaxProfile.trim()}:{ }),...(instrumentFeeProfile.trim()?{feeProfile:instrumentFeeProfile.trim()}:{ }),
      ...(instrumentNotes.trim()?{notes:instrumentNotes.trim()}:{ })
    },previous?text('Enstrümanın yeni sürümü eklendi; geçmiş kod korunuyor.','A new instrument revision was added; the historical code is preserved.'):text('Yeni enstrüman kataloğa eklendi.','The new instrument was added to the catalog.'));
  };

  const submitEvent=()=>{
    if(!workspace?.portfolio)return;
    const direction=defaultDirection(eventType); const gross=Number(grossAmount||'0'); const fees=Number(feeAmount||'0'); const taxes=Number(taxAmount||'0');
    const net=direction==='cash_out'?-(gross+fees+taxes):direction==='cash_in'?gross-fees-taxes:0;
    void record({
      itemType:'ledger_event',portfolioId:workspace.portfolio.id,...(eventInstrumentId?{instrumentId:eventInstrumentId}:{}),eventType,direction,currency:eventCurrency.toLocaleUpperCase(locale),
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
    },`${eventLabels[eventType]} ${text('değişmez portföy defterine eklendi.','was added to the immutable portfolio ledger.')}`);
  };

  const submitPrice=()=>void record({itemType:'price_observation',instrumentId:priceInstrumentId,observedAt:toIso(priceAt),unitPrice:Number(priceValue),currency:priceCurrency.toLocaleUpperCase(locale),sourceLabel:priceSource},text('Manuel fiyat gözlemi eklendi; canlı fiyat doğrulaması yapılmadı.','A manual price observation was added; live price verification was not performed.'));

  const selectInstrumentRevision=(revisionId:string)=>{
    setInstrumentRevisionId(revisionId); const item=currentInstruments.find(value=>value.revisionId===revisionId); if(!item)return;
    setInstrumentClass(item.assetClass);setInstrumentGroup(item.groupLabel);setInstrumentCode(item.code);setInstrumentName(item.name);setInstrumentCurrency(item.currency);setInstrumentStatus(item.status);setInstrumentIsin(item.isin??'');setInstrumentExchange(item.exchange??'');setInstrumentPriceSource(item.priceSource??text('Manuel kullanıcı girişi','Manual user input'));setInstrumentTaxProfile(item.taxProfile??'');setInstrumentFeeProfile(item.feeProfile??'');setInstrumentNotes(item.notes??'');
  };

  const addAllocation=()=>{const candidate=currentInstruments.find(item=>!allocationDraft.some(allocation=>allocation.instrumentId===item.instrumentId&&allocation.sleeve==='custom'));if(candidate)setAllocationDraft(items=>[...items,{instrumentId:candidate.instrumentId,sleeve:'custom',targetBasisPoints:0,displayOrder:items.length+1}]);};
  const updateAllocation=(index:number,patch:Partial<LongTermPortfolioAllocationInput>)=>setAllocationDraft(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item));

  return <section className="ltp-dashboard" aria-label={text('Uzun vadeli portföy merkezi','Long-term portfolio center')}>
    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Yerel ve manuel portföy planlaması','Local manual portfolio planning')} title={text('Uzun Vadeli Portföy','Long-Term Portfolio')}/>
      <div className="ltp-boundary-note"><strong>{text('Takip ve karar desteği; yatırım emri veya tavsiye değildir.','Tracking and decision support; not an investment order or recommendation.')}</strong><br/><small>{text('Canlı fiyat, getiri, vergi/hukuk doğruluğu ve 2032 sonucu garanti edilmez. Dış doğrulama yalnız kaynağı ayrıca işaretlenen kayıtlarda kabul edilir.','Live prices, returns, tax or legal accuracy, and the 2032 outcome are not guaranteed. External verification is accepted only for records whose source is explicitly marked.')}</small></div>
      <nav className="ltp-tabs" aria-label={text('Uzun vadeli portföy bölümleri','Long-term portfolio sections')}>
        {([['overview',text('Genel bakış','Overview')],['plan',text('Aylık plan','Monthly plan')],['instruments',text('Ürün kataloğu','Product catalog')],['transactions',text('Alım / satım','Buy / sell')],['corporate-actions',text('Temettü ve haklar','Dividends and rights')],['projections',text('Grafik ve 2032','Charts and 2032')]] as const).map(([value,label])=><Button key={value} tone={mode===value?'primary':'default'} onClick={()=>setMode(value)}>{label}</Button>)}
      </nav>
      {isRecording&&<StatusMessage>{text('Portföy işlemi kaydediliyor; yinelenen gönderimler engellendi.','The portfolio operation is being saved; duplicate submissions are blocked.')}</StatusMessage>}
      {message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}
      {analytics?.aggregateValuationStatus==='mixed_currency_requires_fx'&&<StatusMessage tone="danger">{text('Baz kura çevrilmemiş','There are')} {analytics.excludedCurrencyInstrumentIds.length} {text('yabancı para pozisyonu bulunduğu için portföy toplamı ve birleşik grafik güvenli biçimde hesaplanmadı; kıymet bazındaki tutarlar kendi para biriminde gösterilir.','foreign-currency positions not converted to the base rate, so the portfolio total and combined chart were not safely calculated; instrument amounts are shown in their own currencies.')}</StatusMessage>}
      {analytics?.aggregateValuationStatus==='missing_prices'&&<StatusMessage>{text('Güncel manuel fiyatı eksik','There are')} {analytics.missingPriceInstrumentIds.length} {text('aktif kıymet bulunduğu için toplam piyasa değeri hesaplanmadı.','active instruments without a current manual price, so total market value was not calculated.')}</StatusMessage>}
      {(analytics?.missingFxEventIds.length??0)>0&&<StatusMessage tone="danger">{analytics?.missingFxEventIds.length} {text('yabancı para işleminde baz kur eksik; ilgili aylık kıymet devri hesaplanmadı.','foreign-currency transactions lack a base exchange rate; the related monthly instrument carryover was not calculated.')}</StatusMessage>}
      {mode==='plan'&&<StatusMessage>{text('Yeni sürüm son geçerlilik ayından ileri olmalıdır. Ocak planında aylık katkı, girilen gerçekleşmiş yıllık enflasyon tabanının altına düşemez.','The new revision must be later than the last effective month. In a January plan, the monthly contribution cannot fall below the entered realized annual inflation baseline.')}</StatusMessage>}
      {mode==='projections'&&workspace?.projections[0]&&<StatusMessage>{text('Projeksiyon başlangıcı:','Projection start:')} {money(workspace.projections[0].startingValue,workspace.activePlan?.contributionCurrency)} · {workspace.projections[0].startingValueSource==='current_market_value'?text('manuel fiyatlarla güncel değer','current value from manual prices'):workspace.projections[0].startingValueSource==='contributed_principal'?text('fiyat eksikken yatırılan anapara','contributed principal while prices are missing'):text('baz para toplamı hesaplanamadığı için sıfır taban','zero baseline because the base-currency total could not be calculated')}. {text('Sonuç yalnız senaryodur.','The result is a scenario only.')}</StatusMessage>}
      {(mode==='transactions'||mode==='corporate-actions')&&eventType==='transfer_out'&&<><label>{text('Bütçe virman hedefi','Budget transfer target')}<select value={transferCounterpartyInstrumentId} onChange={event=>setTransferCounterpartyInstrumentId(event.target.value)}><option value="">{text('Farklı kıymeti seçin','Select a different instrument')}</option>{currentInstruments.filter(item=>item.instrumentId!==eventInstrumentId&&item.currency===eventCurrency).map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><StatusMessage>{text('Bu tek atomik kayıt yalnız aylık/devreden bütçeyi kaynak kıymetten hedef kıymete taşır; kıymet adedi üretmez veya eksiltmez.','This single atomic record moves only the monthly or carried budget from the source instrument to the target instrument; it does not create or reduce security quantity.')}</StatusMessage></>}
    </Surface>

    {!workspace?.portfolio&&<Surface className="workspace-summary"><SectionHeader eyebrow={text('Kullanıcının başlangıç dağılımı','User starter allocation')} title={text('Portföyü tek işlemle kur','Set up portfolio in one operation')}/><div className="ltp-empty-action"><label>{text('Portföy sahibi','Portfolio owner')}<select value={ownerPersonId} onChange={event=>setOwnerPersonId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label>{text('Başlangıç ayı','Start month')}<input type="month" value={effectiveMonth} onChange={event=>setEffectiveMonth(event.target.value)}/></label><label>{text('Hedef tarihi','Target date')}<input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label><Button tone="primary" disabled={!ownerPersonId} onClick={()=>void bootstrap()}>{text('20.000 TL planı ve kataloğu oluştur','Create TRY 20,000 plan and catalog')}</Button></div><small>{text('ASELS, TUPRS, THYAO, KCHOL, BIMAS, AKBNK, EREGL, BETAE, NETCD, TI2, AFT, TTE, KZL, GUF ve PPN; halka arz rezervi uygun ürüne kadar PPN’de tutulur.','ASELS, TUPRS, THYAO, KCHOL, BIMAS, AKBNK, EREGL, BETAE, NETCD, TI2, AFT, TTE, KZL, GUF, and PPN; the IPO reserve remains in PPN until a suitable product is available.')}</small></Surface>}

    {mode==='overview'&&<>
      <div className="ltp-metric-grid">
        <div className="ltp-metric"><small>{text('Toplam yatırılan','Total contributed')}</small><strong>{money(analytics?.totalContributed,analytics?.currency)}</strong><span>{workspace?.ledgerEvents.length??0} {text('defter olayı','ledger events')}</span></div>
        <div className="ltp-metric"><small>{text('Güncel değer','Current value')}</small><strong>{money(analytics?.marketValue,analytics?.currency)}</strong><span>{analytics?.missingPriceInstrumentIds.length??0} {text('eksik fiyat','missing prices')}</span></div>
        <div className="ltp-metric"><small>{text('Net kâr / zarar','Net profit / loss')}</small><strong>{money(analytics?.netProfitLoss,analytics?.currency)}</strong><span>{text('Masraf','Fees')} {money(analytics?.totalFees,analytics?.currency)} · {text('Vergi','Tax')} {money(analytics?.totalTaxes,analytics?.currency)}</span></div>
        <div className="ltp-metric"><small>{text('Temettü / kupon / faiz','Dividend / coupon / interest')}</small><strong>{money(analytics?.totalIncome,analytics?.currency)}</strong><span>{text('Sonraki aya aynı kıymette kalan','Carried to next month in the same instrument')} {money(analytics?.totalCarryover,analytics?.currency)}</span></div>
      </div>
      <Surface className="workspace-summary"><SectionHeader eyebrow={text('Aylık gerçekleşme','Monthly realization')} title={text('Anapara ve güncel değer','Principal and current value')}/>{series.length===0?<EmptyState title={text('Grafik için hareket yok','No activity for chart')} body={text('Alım, gelir ve manuel fiyat gözlemleri eklendikçe aylık seri oluşur.','The monthly series is created as purchases, income, and manual price observations are added.')}/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label={text('Anapara ve portföy değeri zaman serisi','Principal and portfolio value time series')}><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-principal" points={principalLine}/><polyline className="ltp-chart-value" points={valueLine}/></svg><div className="ltp-chart-legend">{text('Mavi: yatırılan anapara · Yeşil: manuel fiyatlarla hesaplanabilen güncel değer','Blue: contributed principal · Green: current value calculated from manual prices')}</div></div>}</Surface>
      <section className="workspace-grid"><Surface className="workspace-summary"><SectionHeader eyebrow={text('Hedef / gerçekleşen','Target / actual')} title={analytics?.rebalanceDue?text('6 aylık dengeleme kontrolü gerekli','6-month rebalancing check required'):text('Dağılım görünümü','Allocation view')}/>{(analytics?.allocationDrift.length??0)===0?<EmptyState title={text('Dağılım hesaplanamadı','Allocation could not be calculated')} body={text('Etkin plan ve güncel fiyatlar bulunduğunda hedef sapmaları gösterilir.','Target deviations are shown when an active plan and current prices are available.')}/>:analytics?.allocationDrift.map(item=><div className="ltp-allocation-row" key={item.allocationId}><span><strong>{item.code}</strong><br/><small>{text('Hedef','Target')} %{(item.targetBasisPoints/100).toLocaleString(locale)}</small></span><span className="ltp-allocation-track"><span className="ltp-allocation-fill" style={{width:`${Math.min(100,item.actualBasisPoints===undefined?0:item.actualBasisPoints/100)}%`}}/></span><span className={item.rebalanceDue?'ltp-drift-warning':''}>{item.actualBasisPoints===undefined?text('Fiyat eksik','Price missing'):`${text('Gerçekleşen','Actual')} %${(item.actualBasisPoints/100).toLocaleString(locale,{maximumFractionDigits:2})}`}</span></div>)}</Surface><Surface className="workspace-summary"><SectionHeader eyebrow={text('Kıymet bazında','By instrument')} title={`${analytics?.positions.length??0} ${text('pozisyon','positions')}`}/>{(analytics?.positions.length??0)===0?<EmptyState title={text('Pozisyon yok','No positions')} body={text('Her kıymetin adet, maliyet, gelir, masraf, vergi ve net sonucu burada izlenir.','Quantity, cost, income, fees, tax, and net result are tracked here for every instrument.')}/>:analytics?.positions.map(position=><div className="context-stat" key={position.instrumentId}><strong>{position.code} · {position.name}</strong><span>{position.quantity.toLocaleString(locale,{maximumFractionDigits:6})} {text('adet','units')} · {text('Değer','Value')} {money(position.marketValue,position.currency)} · {text('Net','Net')} {money(position.netProfitLoss,position.currency)}</span><small>{text('Yatırılan','Contributed')} {money(position.contributedAmount,position.currency)} · {text('Gelir','Income')} {money(position.incomeAmount,position.currency)} · {text('Masraf/vergi','Fees/tax')} {money(position.feeAmount+position.taxAmount,position.currency)} · {text('Devreden','Carryover')} {money(position.carryoverAmount,position.currency)}</small></div>)}</Surface></section>
      <Surface className="workspace-summary"><SectionHeader eyebrow={text('Aynı kıymete otomatik devreden aylık bütçe','Monthly budget automatically carried to the same instrument')} title={latestBudgetMonth??text('Aylık plan bekleniyor','Waiting for monthly plan')}/>{currentBudgetCarryovers.length===0?<EmptyState title={text('Aylık bütçe devri yok','No monthly budget carryover')} body={text('Etkin plan oluştuğunda her kıymetin planlanan, alınan ve sonraki aya kalan tutarı burada hesaplanır.','When an active plan exists, the planned, purchased, and next-month remaining amount for each instrument is calculated here.')}/>:<div style={{overflowX:'auto'}}><table className="ltp-ledger-table"><thead><tr><th>{text('Kıymet','Instrument')}</th><th>{text('Planlanan','Planned')}</th><th>{text('Açılış devri','Opening carryover')}</th><th>{text('Gerçekleşen alım','Actual purchase')}</th><th>{text('Yeniden yatırılacak gelir','Income to reinvest')}</th><th>{text('Açık virman','Explicit transfer')}</th><th>{text('Sonraki aya devir','Carry to next month')}</th></tr></thead><tbody>{currentBudgetCarryovers.map(item=><tr key={`${item.month}-${item.instrumentId}`}><td>{item.code}</td><td>{money(item.plannedAmount,item.currency)}</td><td>{money(item.openingCarryoverAmount,item.currency)}</td><td>{money(item.actualContributionAmount,item.currency)}</td><td>{money(item.reinvestedIncomeAmount,item.currency)}</td><td>{money(item.explicitTransferNetAmount,item.currency)}</td><td>{item.complete?money(item.closingCarryoverAmount,item.currency):text('Kur eksik','Exchange rate missing')}</td></tr>)}</tbody></table></div>}</Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow={text('Ağırlıklı ortalama maliyet katmanı','Weighted-average cost layer')} title={text('Kıymet bazında maliyet ve gerçekleşen sonuç','Cost and realized result by instrument')}/>{(analytics?.positions.length??0)===0?<EmptyState title={text('Maliyet hesabı için işlem yok','No transactions for cost calculation')} body={text('Alım, satım ve hak olayları geldikçe maliyet katmanı hesaplanır.','The cost layer is calculated as purchases, sales, and rights events are recorded.')}/>:analytics?.positions.map(position=><div className="context-stat" key={`cost-${position.instrumentId}`}><strong>{position.code} · {position.costBasisStatus==='calculated_weighted_average'?text('hesaplandı','calculated'):position.costBasisStatus==='unsupported_cost_layer'?text('FIFO/belirli lot ayrıca mutabakat ister','FIFO/specific lot requires separate reconciliation'):text('geçmiş eksik','history incomplete')}</strong><span>{text('Alış brüt','Gross purchases')} {money(position.grossPurchaseAmount,position.currency)} · {text('Satış brüt','Gross sales')} {money(position.grossSaleAmount,position.currency)} · {text('Kalan maliyet','Remaining cost')} {money(position.costBasisAmount,position.currency)} · {text('Ortalama','Average')} {money(position.averageUnitCost,position.currency)}</span><small>{text('Gerçekleşen sonuç','Realized result')} {money(position.realizedProfitLoss,position.currency)} · {text('Gerçekleşmemiş sonuç','Unrealized result')} {money(position.unrealizedProfitLoss,position.currency)} · {text('Toplam net','Total net')} {money(position.netProfitLoss,position.currency)}</small></div>)}</Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow={text('Aylık gelir · gider · aynı kıymete devir','Monthly income · expenses · carryover to same instrument')} title={text('Nakit akışı grafiği','Cash-flow chart')}/>{series.length===0?<EmptyState title={text('Nakit akışı grafiği için veri yok','No data for cash-flow chart')} body={text('Aylık alım, gelir, masraf, vergi ve devreden bütçe oluştuğunda seri görünür.','The series appears when monthly purchases, income, fees, tax, and carried budget exist.')}/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label={text('Aylık gelir masraf vergi ve aynı kıymete devreden bütçe','Monthly income fees tax and budget carried to the same instrument')}><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-income" points={incomeLine}/><polyline className="ltp-chart-cost" points={costLine}/><polyline className="ltp-chart-carryover" points={carryoverLine}/></svg><div className="ltp-chart-legend">{text('Yeşil: temettü/kupon/faiz · Kırmızı: masraf+vergi · Mor: sonraki aya aynı kıymette devreden bütçe','Green: dividend/coupon/interest · Red: fees+tax · Purple: budget carried to next month in the same instrument')}</div></div>}</Surface>
    </>}

    {mode==='plan'&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow={text('Öncekini silmez · yeni sürüm','Keeps previous · new revision')} title={text('Aylık plan ve varsayımlar','Monthly plan and assumptions')}/><div className="ltp-form-grid"><label>{text('Geçerli olacağı ay','Effective month')}<input type="month" value={effectiveMonth} onChange={event=>setEffectiveMonth(event.target.value)}/></label><label>{text('Aylık yatırım tutarı','Monthly investment amount')}<input type="number" min="0.01" step="0.01" value={monthlyContribution} onChange={event=>setMonthlyContribution(event.target.value)}/></label><label className="span-2">{text('Değişiklik nedeni','Reason for change')}<input maxLength={240} value={changeReason} onChange={event=>setChangeReason(event.target.value)}/></label><label>{text('Yeniden dengeleme (ay)','Rebalancing (months)')}<input type="number" min="1" max="60" value={rebalanceMonths} onChange={event=>setRebalanceMonths(event.target.value)}/></label><label>{text('Hedef tarihi','Target date')}<input type="date" value={targetDate} onChange={event=>setTargetDate(event.target.value)}/></label><label>{text('Kötümser yıllık getiri (%)','Pessimistic annual return (%)')}<input type="number" step="0.01" value={pessimisticReturn} onChange={event=>setPessimisticReturn(event.target.value)}/></label><label>{text('Temel yıllık getiri (%)','Base annual return (%)')}<input type="number" step="0.01" value={baseReturn} onChange={event=>setBaseReturn(event.target.value)}/></label><label>{text('İyimser yıllık getiri (%)','Optimistic annual return (%)')}<input type="number" step="0.01" value={optimisticReturn} onChange={event=>setOptimisticReturn(event.target.value)}/></label><label>{text('Yıllık enflasyon (%)','Annual inflation (%)')}<input type="number" step="0.01" value={inflation} onChange={event=>setInflation(event.target.value)}/></label><label>{text('Yıllık katkı artışı (%)','Annual contribution growth (%)')}<input type="number" step="0.01" value={contributionGrowth} onChange={event=>setContributionGrowth(event.target.value)}/></label></div><div className="notes-card"><strong>{text('Dağılım toplamı','Allocation total')} %{(allocationTotal/100).toLocaleString(locale,{maximumFractionDigits:2})}</strong><small>{text('Aylık kıymet bakiyesi aynı kıymete devreder; başka kıymete geçiş yalnız açık virman kaydıyla yapılır.','The monthly instrument balance carries to the same instrument; moving to another instrument requires an explicit transfer record.')}</small></div>{allocationDraft.map((item,index)=><div className="ltp-allocation-row" key={`${item.instrumentId}-${item.sleeve}-${index}`}><select value={item.instrumentId} onChange={event=>updateAllocation(index,{instrumentId:event.target.value})}>{currentInstruments.map(instrument=><option key={instrument.instrumentId} value={instrument.instrumentId}>{instrument.code} · {instrument.name}</option>)}</select><input aria-label={text('Hedef oran yüzde','Target percentage')} type="number" min="0" max="100" step="0.01" value={item.targetBasisPoints/100} onChange={event=>updateAllocation(index,{targetBasisPoints:percentToBasisPoints(event.target.value)})}/><select value={item.sleeve} onChange={event=>updateAllocation(index,{sleeve:event.target.value as LongTermPortfolioAllocationInput['sleeve']})}><option value="core">{text('Çekirdek','Core')}</option><option value="growth">{text('Büyüme','Growth')}</option><option value="opportunity">{text('Fırsat','Opportunity')}</option><option value="ipo_reserve">{text('Halka arz rezervi','IPO reserve')}</option><option value="liquidity">{text('Likidite','Liquidity')}</option><option value="hedge">{text('Koruma','Hedge')}</option><option value="custom">{text('Özel','Custom')}</option></select></div>)}<Button onClick={addAllocation}>{text('Dağılım satırı ekle','Add allocation row')}</Button><Button tone="primary" disabled={!workspace?.portfolio||allocationTotal!==10000||!monthlyContribution||!effectiveMonth} onClick={submitPlan}>{text('Yeni plan sürümünü kaydet','Save new plan revision')}</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow={text('Sürüm geçmişi','Revision history')} title={`${workspace?.planVersions.length??0} ${text('plan','plans')}`}/>{workspace?.planVersions.map(plan=><div className="context-stat" key={plan.id}><strong>v{plan.version} · {plan.effectiveMonth} · {money(plan.monthlyContribution,plan.contributionCurrency)}</strong><span>{plan.allocations.length} {text('dağılım','allocations')} · {plan.rebalanceIntervalMonths} {text('ayda bir dengeleme','month rebalance interval')} · {plan.contributionChangeReason}</span><small>{text('Oluşturma','Created')} {date(plan.createdAt)} · {text('Önceki sürüm değiştirilmedi','Previous revision unchanged')}</small></div>)}</Surface></section>}

    {mode==='instruments'&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow={text('Kararlı kimlik · sürümlü kod','Stable ID · versioned code')} title={text('Yatırım ürünü ekle veya yeni sürüm oluştur','Add an investment product or create a new revision')}/><label>{text('İşlem','Action')}<select value={instrumentRevisionId} onChange={event=>selectInstrumentRevision(event.target.value)}><option value="">{text('Yeni ürün','New product')}</option>{currentInstruments.map(item=><option key={item.revisionId} value={item.revisionId}>{item.code} · {text('yeni sürüm','new revision')}</option>)}</select></label><div className="ltp-form-grid"><label>{text('Başlık','Asset class')}<select value={instrumentClass} onChange={event=>setInstrumentClass(event.target.value as LongTermPortfolioAssetClass)}>{Object.entries(assetClassLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>{text('Grup','Group')}<input maxLength={80} value={instrumentGroup} onChange={event=>setInstrumentGroup(event.target.value)}/></label><label>{text('Kod','Code')}<input maxLength={32} value={instrumentCode} onChange={event=>setInstrumentCode(event.target.value)}/></label><label>{text('Ad','Name')}<input maxLength={180} value={instrumentName} onChange={event=>setInstrumentName(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input maxLength={3} value={instrumentCurrency} onChange={event=>setInstrumentCurrency(event.target.value)}/></label><label>{text('Durum','Status')}<select value={instrumentStatus} onChange={event=>setInstrumentStatus(event.target.value as LongTermPortfolioInstrumentRevisionView['status'])}><option value="active">{text('Aktif','Active')}</option><option value="inactive">{text('Pasif','Inactive')}</option><option value="matured">{text('Vadesi doldu','Matured')}</option><option value="merged">{text('Birleşti','Merged')}</option></select></label><label>ISIN<input value={instrumentIsin} onChange={event=>setInstrumentIsin(event.target.value)}/></label><label>{text('Borsa / piyasa','Exchange / market')}<input value={instrumentExchange} onChange={event=>setInstrumentExchange(event.target.value)}/></label><label>{text('Fiyat kaynağı','Price source')}<input value={instrumentPriceSource} onChange={event=>setInstrumentPriceSource(event.target.value)}/></label><label>{text('Vergi profili','Tax profile')}<input value={instrumentTaxProfile} onChange={event=>setInstrumentTaxProfile(event.target.value)}/></label><label>{text('Masraf profili','Fee profile')}<input value={instrumentFeeProfile} onChange={event=>setInstrumentFeeProfile(event.target.value)}/></label><label>{text('Not','Notes')}<input value={instrumentNotes} onChange={event=>setInstrumentNotes(event.target.value)}/></label></div><Button tone="primary" disabled={instrumentCode.trim().length<1||instrumentName.trim().length<2} onClick={submitInstrument}>{instrumentRevisionId?text('Yeni sürümü ekle','Add new revision'):text('Ürünü ekle','Add product')}</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow={text('Kod değişse de geçmiş kopmaz','History remains linked when the code changes')} title={`${currentInstruments.length} ${text('güncel ürün','current products')}`}/>{currentInstruments.map(item=><div className="context-stat" key={item.instrumentId}><strong>{item.code} · {item.name}</strong><span>{assetClassLabels[item.assetClass]} · {item.currency} · {item.status==='active'?text('Aktif','Active'):item.status==='inactive'?text('Pasif','Inactive'):item.status==='matured'?text('Vadesi doldu','Matured'):text('Birleşti','Merged')}</span><small>{item.priceSource??text('Fiyat kaynağı yok','No price source')} · {text('Dış doğrulama','External verification')}: {externalVerificationLabels[item.externalVerification]}</small></div>)}</Surface></section>}

    {(mode==='transactions'||mode==='corporate-actions')&&<section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow={text('Yalnız ekleme · düzeltme ters kayıtla','Append-only · corrections by reversal')} title={mode==='transactions'?text('Alım, satım, virman ve gider','Purchases, sales, transfers, and expenses'):text('Temettü, bedelli, bedelsiz ve diğer haklar','Dividends, rights issues, bonus shares, and other entitlements')}/><label>{text('Olay türü','Event type')}<select value={eventType} onChange={event=>setEventType(event.target.value as LongTermPortfolioLedgerEventType)}>{Object.entries(eventLabels).filter(([value])=>mode==='corporate-actions'?corporateEvents.has(value as LongTermPortfolioLedgerEventType):!corporateEvents.has(value as LongTermPortfolioLedgerEventType)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>{text('Kıymet','Instrument')}<select value={eventInstrumentId} onChange={event=>setEventInstrumentId(event.target.value)}><option value="">{text('Nakit / portföy geneli','Cash / portfolio-wide')}</option>{currentInstruments.map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><div className="ltp-form-grid"><label>{text('Sipariş tarihi/saati','Order date/time')}<input type="datetime-local" value={orderAt} onChange={event=>setOrderAt(event.target.value)}/></label><label>{text('Gerçekleşme tarihi/saati','Execution date/time')}<input type="datetime-local" value={executedAt} onChange={event=>setExecutedAt(event.target.value)}/></label><label>{text('Takas / valör tarihi','Settlement / value date')}<input type="datetime-local" value={settlementAt} onChange={event=>setSettlementAt(event.target.value)}/></label><label>{text('Hak kazanım tarihi','Entitlement date')}<input type="datetime-local" value={entitlementAt} onChange={event=>setEntitlementAt(event.target.value)}/></label><label>{text('Kayıt tarihi','Record date')}<input type="datetime-local" value={recordAt} onChange={event=>setRecordAt(event.target.value)}/></label><label>{text('Ödeme tarihi','Payment date')}<input type="datetime-local" value={paymentAt} onChange={event=>setPaymentAt(event.target.value)}/></label><label>{text('Adet','Quantity')}<input type="number" step="any" value={eventQuantity} onChange={event=>setEventQuantity(event.target.value)}/></label><label>{text('Birim fiyat','Unit price')}<input type="number" step="any" value={unitPrice} onChange={event=>setUnitPrice(event.target.value)}/></label><label>{text('Brüt tutar','Gross amount')}<input type="number" min="0" step="0.01" value={grossAmount} onChange={event=>setGrossAmount(event.target.value)}/></label><label>{text('Komisyon / masraf','Commission / fee')}<input type="number" min="0" step="0.01" value={feeAmount} onChange={event=>setFeeAmount(event.target.value)}/></label><label>{text('Vergi','Tax')}<input type="number" min="0" step="0.01" value={taxAmount} onChange={event=>setTaxAmount(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input maxLength={3} value={eventCurrency} onChange={event=>setEventCurrency(event.target.value)}/></label><label>{text('Kur','Exchange rate')}<input type="number" min="0" step="any" value={fxRate} onChange={event=>setFxRate(event.target.value)}/></label><label>{text('Aracı kurum','Broker')}<input value={broker} onChange={event=>setBroker(event.target.value)}/></label><label>{text('Hesap referansı','Account reference')}<input value={accountReference} onChange={event=>setAccountReference(event.target.value)}/></label><label>{text('Sipariş referansı','Order reference')}<input value={orderReference} onChange={event=>setOrderReference(event.target.value)}/></label><label>{text('Gerçekleşme referansı','Execution reference')}<input value={executionReference} onChange={event=>setExecutionReference(event.target.value)}/></label><label>{text('Kısmi gerçekleşme sıra no','Partial-fill sequence no.')}<input type="number" min="1" step="1" value={partialFillSequence} onChange={event=>setPartialFillSequence(event.target.value)}/></label><label>{text('Lot / maliyet katmanı','Lot / cost layer')}<input value={lotReference} onChange={event=>setLotReference(event.target.value)}/></label><label>{text('Maliyet yöntemi','Cost method')}<select value={costLayerMethod} onChange={event=>setCostLayerMethod(event.target.value as LongTermPortfolioLedgerEventView['costLayerMethod'])}><option value="weighted_average">{text('Ağırlıklı ortalama','Weighted average')}</option><option value="fifo">FIFO</option><option value="specific_lot">{text('Belirli lot','Specific lot')}</option><option value="not_applicable">{text('Uygulanmaz','Not applicable')}</option></select></label><label>{text('Kurumsal işlem referansı','Corporate-action reference')}<input value={corporateActionReference} onChange={event=>setCorporateActionReference(event.target.value)}/></label><label>{text('Oran pay','Ratio numerator')}<input type="number" min="0" step="any" value={ratioNumerator} onChange={event=>setRatioNumerator(event.target.value)}/></label><label>{text('Oran payda','Ratio denominator')}<input type="number" min="0" step="any" value={ratioDenominator} onChange={event=>setRatioDenominator(event.target.value)}/></label><label>{text('Ters çevrilecek kayıt','Entry to reverse')}<select value={reversalOfEventId} onChange={event=>setReversalOfEventId(event.target.value)}><option value="">{text('Ters kayıt değil','Not a reversal')}</option>{workspace?.ledgerEvents.filter(item=>item.eventType!=='reversal').map(item=><option key={item.id} value={item.id}>{eventLabels[item.eventType]} · {date(item.executedAt)}</option>)}</select></label><label>{text('Düzeltme gerekçesi','Correction reason')}<input disabled={!reversalOfEventId} value={correctionReason} onChange={event=>setCorrectionReason(event.target.value)}/></label><label>{text('Kaynak etiketi','Source label')}<input value={sourceLabel} onChange={event=>setSourceLabel(event.target.value)}/></label><label>{text('Belge / dekont referansı','Document / receipt reference')}<input value={sourceDocumentReference} onChange={event=>setSourceDocumentReference(event.target.value)}/></label><label className="span-2">{text('Not','Notes')}<input value={eventNotes} onChange={event=>setEventNotes(event.target.value)}/></label></div><div className="notes-card"><strong>{text('Hesaplanan net nakit','Calculated net cash')}: {money((()=>{const gross=Number(grossAmount||'0'),fee=Number(feeAmount||'0'),tax=Number(taxAmount||'0'),direction=defaultDirection(eventType);return direction==='cash_out'?-(gross+fee+tax):direction==='cash_in'?gross-fee-tax:0;})(),eventCurrency)}</strong><small>{text('Kısmi gerçekleşmeler ayrı satırdır. Yanlış kayıt silinmez/değiştirilmez; yalnız referanslı ters kayıt eklenir.','Partial fills are separate rows. An incorrect entry is never deleted or changed; only a referenced reversal entry is added.')}</small></div><Button tone="primary" disabled={!workspace?.portfolio||!executedAt||(eventType==='reversal'&&(!reversalOfEventId||correctionReason.trim().length<3))} onClick={submitEvent}>{eventLabels[eventType]} {text('kaydet','save')}</Button></Surface><Surface className="workspace-summary"><SectionHeader eyebrow={text('Tarih ve kaynak kanıtlı','Date and source evidenced')} title={`${workspace?.ledgerEvents.length??0} ${text('defter kaydı','ledger entries')}`}/>{(workspace?.ledgerEvents.length??0)===0?<EmptyState title={text('İşlem yok','No transactions')} body={text('Alım, satım veya kurumsal işlem kaydedildiğinde bütün tarih ve maliyet alanlarıyla burada görünür.','A purchase, sale, or corporate action appears here with all date and cost fields once recorded.')}/>:<div style={{overflowX:'auto'}}><table className="ltp-ledger-table"><thead><tr><th>{text('İşlem','Transaction')}</th><th>{text('Kıymet','Instrument')}</th><th>{text('Sipariş','Order')}</th><th>{text('Gerçekleşme','Execution')}</th><th>{text('Takas/ödeme','Settlement/payment')}</th><th>{text('Adet','Quantity')}</th><th>{text('Brüt','Gross')}</th><th>{text('Masraf+vergi','Fees+tax')}</th><th>{text('Kaynak','Source')}</th></tr></thead><tbody>{workspace?.ledgerEvents.map(item=><tr key={item.id}><td>{eventLabels[item.eventType]}{item.partialFillSequence?` #${item.partialFillSequence}`:''}</td><td>{currentInstruments.find(value=>value.instrumentId===item.instrumentId)?.code??text('Nakit','Cash')}</td><td>{date(item.orderAt)}</td><td>{date(item.executedAt)}</td><td>{date(item.paymentAt??item.settlementAt)}</td><td>{item.quantity?.toLocaleString(locale,{maximumFractionDigits:6})??'—'}</td><td>{money(item.grossAmount,item.currency)}</td><td>{money(item.feeAmount+item.taxAmount,item.currency)}</td><td>{item.sourceLabel}</td></tr>)}</tbody></table></div>}</Surface></section>}

    {mode==='projections'&&<><section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow={text('Manuel ve zaman damgalı','Manual and timestamped')} title={text('Fiyat gözlemi ekle','Add price observation')}/><label>{text('Kıymet','Instrument')}<select value={priceInstrumentId} onChange={event=>setPriceInstrumentId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{currentInstruments.map(item=><option key={item.instrumentId} value={item.instrumentId}>{item.code} · {item.name}</option>)}</select></label><label>{text('Gözlem zamanı','Observation time')}<input type="datetime-local" value={priceAt} onChange={event=>setPriceAt(event.target.value)}/></label><label>{text('Birim fiyat','Unit price')}<input type="number" min="0.000001" step="any" value={priceValue} onChange={event=>setPriceValue(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input maxLength={3} value={priceCurrency} onChange={event=>setPriceCurrency(event.target.value)}/></label><label>{text('Kaynak etiketi','Source label')}<input value={priceSource} onChange={event=>setPriceSource(event.target.value)}/></label><Button tone="primary" disabled={!priceInstrumentId||!priceValue||!priceAt} onClick={submitPrice}>{text('Fiyatı kaydet','Save price')}</Button><small>{text('Canlı piyasa bağlantısı veya fiyat teslim garantisi yoktur.','There is no live-market connection or price-delivery guarantee.')}</small></Surface><Surface className="workspace-summary"><SectionHeader eyebrow={text('Kötümser · temel · iyimser','Pessimistic · base · optimistic')} title={text('2032 nominal ve reel tahmin','2032 nominal and real projection')}/>{workspace?.projections.map(scenario=><div className="context-stat" key={scenario.scenario}><strong>{scenario.scenario==='pessimistic'?text('Kötümser','Pessimistic'):scenario.scenario==='base'?text('Temel','Base'):text('İyimser','Optimistic')} · %{(scenario.annualReturnBasisPoints/100).toLocaleString(locale)}</strong><span>{text('Nominal','Nominal')} {money(scenario.terminalNominalValue,workspace.activePlan?.contributionCurrency)} · {text('Reel','Real')} {money(scenario.terminalRealValue,workspace.activePlan?.contributionCurrency)}</span><small>{text('Varsayım tabanlıdır; gerçekleşme veya getiri garantisi değildir.','It is assumption-based and does not guarantee performance or returns.')}</small></div>)}</Surface></section><Surface className="workspace-summary"><SectionHeader eyebrow={text('Temel senaryo','Base scenario')} title={text('Katkı ve tahmini gelecek değer','Contributions and projected future value')}/>{projectionPoints.length===0?<EmptyState title={text('Projeksiyon yok','No projection')} body={text('Etkin plan oluşturulduğunda düzenlenebilir varsayımlarla 2032 serisi hesaplanır.','When an active plan is created, the 2032 series is calculated using editable assumptions.')}/>:<div className="ltp-chart"><svg viewBox="0 0 760 190" role="img" aria-label={text('2032 temel senaryo nominal portföy tahmini','2032 base-scenario nominal portfolio projection')}><line className="ltp-chart-grid" x1="0" y1="180" x2="760" y2="180"/><polyline className="ltp-chart-projection" points={projectionLine}/></svg><div className="ltp-chart-legend">{text('Kesikli turuncu: düzenlenebilir getiri, enflasyon ve katkı artışı varsayımlarıyla nominal temel senaryo','Dashed orange: nominal base scenario using editable return, inflation, and contribution-growth assumptions')}</div></div>}</Surface></>}
  </section>;
}
