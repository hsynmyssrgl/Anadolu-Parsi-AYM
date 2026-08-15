import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  CHILD_EDUCATION_AREAS,
  CHILD_EDUCATION_KINDS,
  CHILD_EDUCATION_VISIBILITIES,
  childEducationAreaForKind,
  childEducationCenterId,
  childEducationPrivacyExplanationFor,
  type ChildEducationAgeBand,
  type ChildEducationCenterView,
  type ChildEducationItemView,
  type ChildEducationMutationKind,
  type ChildEducationMutationReceiptView,
  type ChildEducationVisibility,
  type CreateChildEducationItemInput,
  type DeleteChildEducationItemInput,
  type UpdateChildEducationItemInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import {
  childEducationVisibilityPrivacy,
  type ChildEducationCenterKey,
  type ChildEducationItemRow,
  type ChildEducationMutationRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface ChildEducationCoordinationQueryPort {
  getCenter(
    context: LifeApplicationContext,
    childPersonId: string
  ): Promise<Result<ChildEducationCenterView, AppError>>;
}

export interface ChildEducationCoordinationWriteScope {
  readonly occurredAt: ChildEducationMutationRow['occurredAt'];
  findPerson(personId: string): Result<{
    readonly id: string;
    readonly familyId: string;
    readonly status: string;
    readonly birthDate?: string;
  } | null, AppError>;
  authorize(input: {
    readonly action: 'read' | 'create' | 'update' | 'delete';
    readonly resourceType: 'child_education_item';
    readonly resourceId: string;
    readonly ownerPersonId: string;
    readonly privacy: 'private' | 'selected_members' | 'family';
  }): Result<boolean, AppError>;
  findItem(key: ChildEducationCenterKey, itemId: string): Result<ChildEducationItemRow | null, AppError>;
  findMutation(key: ChildEducationCenterKey, clientOperationId: string): Result<ChildEducationMutationRow | null, AppError>;
  insertMutation(row: ChildEducationMutationRow): Result<void, AppError>;
  insertItem(row: ChildEducationItemRow): Result<void, AppError>;
  saveItem(row: ChildEducationItemRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: ChildEducationMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface ChildEducationCoordinationUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: ChildEducationCoordinationWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const kinds = new Set<string>(CHILD_EDUCATION_KINDS);
const visibilities = new Set<string>(CHILD_EDUCATION_VISIBILITIES);
const statuses = new Set<ChildEducationItemView['status']>([
  'planned','active','submitted','completed','cancelled','expired','archived'
]);

const hash = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(value), 'utf8')
  .digest('hex');

const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT
    | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });

const invalid = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');

const text = (
  context: LifeApplicationContext,
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
): Result<string, AppError> => {
  if (typeof value !== 'string') return err(invalid(context, `${label} metin olmalıdır.`));
  const normalized = value.normalize('NFKC').trim();
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized)
    ? ok(normalized)
    : err(invalid(context, `${label} sınırları veya karakterleri geçersizdir.`));
};

const optionalText = (
  context: LifeApplicationContext,
  value: unknown,
  label: string,
  maximum: number
): Result<string | undefined, AppError> => value === undefined
  ? ok(undefined)
  : text(context, value, label, 1, maximum);

const timestamp = (
  context: LifeApplicationContext,
  value: unknown,
  label: string
): Result<ChildEducationMutationRow['occurredAt'] | undefined, AppError> => {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    return err(invalid(context, `${label} geçersizdir.`));
  }
  return ok(asIsoDateTime(new Date(Date.parse(value)).toISOString()));
};

const ageBandAt = (
  context: LifeApplicationContext,
  birthDate: string | undefined,
  occurredAt: string
): Result<ChildEducationAgeBand, AppError> => {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/u.test(birthDate)) {
    return err(invalid(context, 'Çocuk eğitim profili için doğrulanmış doğum tarihi zorunludur.'));
  }
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const at = new Date(occurredAt);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = at.getUTCMonth() < birth.getUTCMonth()
    || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (age < 0 || age >= 18) return err(invalid(context, 'Eğitim merkezi yalnız 18 yaş altı etkin aile üyeleri içindir.'));
  return ok(age < 13 ? 'under_13' : 'teen');
};

const keyFor = (
  context: LifeApplicationContext,
  childPersonId: string
): Result<ChildEducationCenterKey, AppError> => {
  if (!context.actor.personId || !SAFE_ID.test(childPersonId)) {
    return err(denied(context, 'Çocuk eğitim merkezi kişi bağlı etkin oturum ve geçerli çocuk kimliği gerektirir.'));
  }
  return ok(Object.freeze({
    familyId: context.familyId,
    accountId: context.actor.userId,
    actorPersonId: context.actor.personId,
    childPersonId: asPersonId(childPersonId),
    centerId: childEducationCenterId(context.familyId, childPersonId)
  }));
};

const readIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'child_education_center',
  resourceId: '*', purpose: 'general'
});

const writeIntent = (
  itemId: string,
  action: 'create' | 'update' | 'delete',
  childPersonId?: string,
  visibility?: ChildEducationVisibility
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType: 'child_education_item', resourceId: itemId,
  purpose: 'general',
  ...(action === 'create' && childPersonId && visibility
    ? { ownerPersonId: asPersonId(childPersonId), privacy: childEducationVisibilityPrivacy(visibility) }
    : {})
});

const identifiers = (
  context: LifeApplicationContext,
  clientOperationId: string,
  itemId: string,
  mutationKind: ChildEducationMutationKind,
  request: unknown
) => {
  const seed = `${context.familyId}|${context.actor.userId}|${clientOperationId}|${itemId}|${mutationKind}`;
  return Object.freeze({
    mutationId: hash(`mutation|${seed}`),
    requestFingerprint: hash(request),
    auditId: hash(`audit|${seed}`),
    eventId: asEventId(hash(`event|${seed}`))
  });
};

const itemFingerprint = (row: Omit<ChildEducationItemRow, 'stateFingerprint'>): string => hash({
  id:row.id,familyId:row.familyId,childPersonId:row.childPersonId,kind:row.kind,area:row.area,
  title:row.title,status:row.status,visibility:row.visibility,revision:row.revision,
  institutionLabel:row.institutionLabel??null,classLabel:row.classLabel??null,subjectLabel:row.subjectLabel??null,
  scheduledAt:row.scheduledAt??null,dueAt:row.dueAt??null,recurrence:row.recurrence??null,
  transportMode:row.transportMode??null,authorityReferenceId:row.authorityReferenceId??null,
  amountMinor:row.amountMinor??null,currency:row.currency??null,progressBasisPoints:row.progressBasisPoints??null,
  certificateStatus:row.certificateStatus??null,note:row.note??null,lastMutationId:row.lastMutationId,
  createdAt:row.createdAt,updatedAt:row.updatedAt,deletedAt:row.deletedAt??null
});

const receipt = (row: ChildEducationMutationRow, replayed: boolean): ChildEducationMutationReceiptView => Object.freeze({
  itemId:row.itemId,childPersonId:row.childPersonId,mutationKind:row.mutationKind,
  previousRevision:row.expectedRevision,revision:row.revision,occurredAt:row.occurredAt,
  replayed,localOnly:true,externalAction:'not_performed'
});

const authorize = (
  context: LifeApplicationContext,
  scope: ChildEducationCoordinationWriteScope,
  action: 'create' | 'update' | 'delete',
  itemId: string,
  childPersonId: string,
  visibility: ChildEducationVisibility
): Result<void, AppError> => {
  const result = scope.authorize({
    action, resourceType:'child_education_item', resourceId:itemId, ownerPersonId:childPersonId,
    privacy:childEducationVisibilityPrivacy(visibility)
  });
  return result.ok && result.value
    ? ok(undefined)
    : result.ok ? err(denied(context, 'Çocuk eğitim kaydı görünürlük sınırı işlemi reddetti.')) : result;
};

const childProfile = (
  context: LifeApplicationContext,
  scope: ChildEducationCoordinationWriteScope,
  childPersonId: string
): Result<ChildEducationAgeBand, AppError> => {
  const found = scope.findPerson(childPersonId);
  if (!found.ok) return found;
  if (!found.value || found.value.familyId !== context.familyId || found.value.status !== 'active') {
    return err(missing(context, 'Etkin aile içindeki çocuk profili bulunamadı.'));
  }
  return ageBandAt(context, found.value.birthDate, scope.occurredAt);
};

const privateZone = (
  context: LifeApplicationContext,
  ageBand: ChildEducationAgeBand,
  childPersonId: string,
  visibility: ChildEducationVisibility
): Result<void, AppError> => visibility !== 'adolescent_private'
  ? ok(undefined)
  : ageBand === 'teen' && context.actor.personId === childPersonId
    ? ok(undefined)
    : err(denied(context, 'Ergen özel alanı yalnız 13–17 yaşındaki kayıt sahibi tarafından yönetilebilir.'));

const normalizedCreate = (
  context: LifeApplicationContext,
  input: CreateChildEducationItemInput
): Result<Omit<ChildEducationItemRow,
  'familyId'|'revision'|'privacyExplanationCode'|'stateFingerprint'|'lastMutationId'|'createdAt'|'updatedAt'
>, AppError> => {
  if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.itemId) || !SAFE_ID.test(input.childPersonId)
    || !kinds.has(input.kind) || !visibilities.has(input.visibility)
    || (input.status !== undefined && !statuses.has(input.status))) {
    return err(invalid(context, 'Çocuk eğitim komutu kimlik, tür, durum veya görünürlük bakımından geçersizdir.'));
  }
  const title = text(context,input.title,'Başlık',2,160); if (!title.ok) return title;
  const institution = optionalText(context,input.institutionLabel,'Kurum',120); if (!institution.ok) return institution;
  const classLabel = optionalText(context,input.classLabel,'Sınıf',80); if (!classLabel.ok) return classLabel;
  const subject = optionalText(context,input.subjectLabel,'Ders',80); if (!subject.ok) return subject;
  const scheduled = timestamp(context,input.scheduledAt,'Başlangıç'); if (!scheduled.ok) return scheduled;
  const due = timestamp(context,input.dueAt,'Bitiş/vade'); if (!due.ok) return due;
  const recurrence = optionalText(context,input.recurrence,'Tekrar',160); if (!recurrence.ok) return recurrence;
  const authority = optionalText(context,input.authorityReferenceId,'Teslim yetkisi referansı',128); if (!authority.ok) return authority;
  const note = optionalText(context,input.note,'Not',2000); if (!note.ok) return note;
  if (scheduled.value && due.value && due.value < scheduled.value) return err(invalid(context,'Bitiş/vade başlangıçtan önce olamaz.'));
  const institutionRequired = ['school','class','course','sport','certificate'].includes(input.kind);
  const subjectRequired = ['timetable','homework','exam'].includes(input.kind);
  if (institutionRequired !== Boolean(institution.value) || subjectRequired !== Boolean(subject.value)) {
    return err(invalid(context,'Eğitim türü kurum veya ders alanıyla exact eşleşmelidir.'));
  }
  if ((input.kind === 'transport_plan') !== Boolean(input.transportMode)
    || (input.kind === 'pickup_authority') !== Boolean(authority.value)) {
    return err(invalid(context,'Servis veya teslim yetkisi alanları türle exact eşleşmelidir.'));
  }
  const money = input.kind === 'allowance_budget';
  if (money !== (Number.isSafeInteger(input.amountMinor) && (input.amountMinor ?? -1) >= 0
    && (input.amountMinor ?? 0) <= 9_000_000_000_000_000 && typeof input.currency === 'string' && CURRENCY.test(input.currency))) {
    return err(invalid(context,'Harçlık bütçesi güvenli tutar ve ISO para birimi gerektirir; ödeme yetkisi vermez.'));
  }
  const goal = input.kind === 'education_goal';
  if (goal !== (Number.isInteger(input.progressBasisPoints) && (input.progressBasisPoints ?? -1) >= 0
    && (input.progressBasisPoints ?? 10_001) <= 10_000)) {
    return err(invalid(context,'Eğitim hedefi 0–10000 baz puan ilerleme gerektirir.'));
  }
  return ok(Object.freeze({
    id:input.itemId,childPersonId:asPersonId(input.childPersonId),kind:input.kind,area:childEducationAreaForKind(input.kind),
    title:title.value,status:input.status??'planned',visibility:input.visibility,
    ...(institution.value?{institutionLabel:institution.value}:{}),...(classLabel.value?{classLabel:classLabel.value}:{}),
    ...(subject.value?{subjectLabel:subject.value}:{}),...(scheduled.value?{scheduledAt:scheduled.value}:{}),
    ...(due.value?{dueAt:due.value}:{}),...(recurrence.value?{recurrence:recurrence.value}:{}),
    ...(input.transportMode?{transportMode:input.transportMode}:{}),...(authority.value?{authorityReferenceId:authority.value}:{}),
    ...(money?{amountMinor:input.amountMinor!,currency:input.currency!}:{}),
    ...(goal?{progressBasisPoints:input.progressBasisPoints!}:{}),
    ...(input.kind==='certificate'?{certificateStatus:'locally_recorded_unverified' as const}:{}),
    ...(note.value?{note:note.value}:{})
  }));
};

const replay = (
  context: LifeApplicationContext,
  found: ChildEducationMutationRow | null,
  expected: { readonly kind:ChildEducationMutationKind; readonly itemId:string; readonly childPersonId:string;
    readonly expectedRevision:number; readonly requestFingerprint:string }
): Result<ChildEducationMutationReceiptView | null, AppError> => {
  if (!found) return ok(null);
  return found.mutationKind===expected.kind && found.itemId===expected.itemId
    && found.childPersonId===expected.childPersonId && found.expectedRevision===expected.expectedRevision
    && found.requestFingerprint===expected.requestFingerprint
    ? ok(receipt(found,true))
    : err(conflict(context,'Aynı işlem kimliği farklı çocuk eğitim içeriğiyle yeniden kullanılamaz.'));
};

const persist = (
  context: LifeApplicationContext,
  scope: ChildEducationCoordinationWriteScope,
  mutation: ChildEducationMutationRow,
  item: ChildEducationItemRow,
  expectedRevision: number,
  auditId: string,
  eventId: ReturnType<typeof asEventId>
): Result<ChildEducationMutationReceiptView, AppError> => {
  const ledger=scope.insertMutation(mutation); if(!ledger.ok)return ledger;
  const current=expectedRevision===0?scope.insertItem(item):scope.saveItem(item,expectedRevision); if(!current.ok)return current;
  const audit=scope.appendAudit({id:auditId,action:`child_education.${mutation.mutationKind}`,
    resourceType:'child_education_item',resourceId:item.id,occurredAt:mutation.occurredAt,actorId:context.actor.userId});
  if(!audit.ok)return audit;
  const event=scope.enqueueEvent({eventId,eventType:`child_education.${mutation.mutationKind}`,eventVersion:1,
    aggregateType:'child_education_item',aggregateId:item.id,occurredAt:mutation.occurredAt,
    actorId:context.actor.userId,correlationId:context.correlationId,payload:{
      itemId:item.id,kind:item.kind,area:item.area,status:item.status,revision:item.revision,
      privacyExplanationCode:item.privacyExplanationCode
    }});
  return event.ok?ok(receipt(mutation,false)):event;
};

const mutationRow = (
  context: LifeApplicationContext,
  key: ChildEducationCenterKey,
  item: ChildEducationItemRow,
  kind: ChildEducationMutationKind,
  clientOperationId: string,
  expectedRevision: number,
  ids: ReturnType<typeof identifiers>,
  occurredAt: ChildEducationMutationRow['occurredAt']
): ChildEducationMutationRow => Object.freeze({
  id:ids.mutationId,familyId:key.familyId,childPersonId:key.childPersonId,itemId:item.id,
  actorAccountId:context.actor.userId,actorPersonId:context.actor.personId!,mutationKind:kind,
  clientOperationId,requestFingerprint:ids.requestFingerprint,expectedRevision,revision:item.revision,
  itemStateFingerprint:item.stateFingerprint,occurredAt
});

export const childEducationTruth = Object.freeze({
  localOnly:true as const,childDataClassEnforced:true as const,aiProcessingAllowed:false as const,
  externalSharingAllowed:false as const,schoolPortalSync:'not_configured' as const,
  teacherMessaging:'not_performed' as const,liveTransportTracking:'not_performed' as const,
  pickupCredentialIssuance:'managed_separately_in_identity_center' as const,
  allowancePaymentExecution:'not_performed' as const,certificateVerification:'not_performed' as const,
  healthDataDuplicated:false as const,ageAppropriatePresentation:'derived_from_local_birth_date' as const
});

export const emptyChildEducationCounts = () => Object.fromEntries(
  CHILD_EDUCATION_AREAS.map((area)=>[area,0])
) as Record<(typeof CHILD_EDUCATION_AREAS)[number],number>;

export class GetChildEducationCenterUseCase {
  public constructor(private readonly query: ChildEducationCoordinationQueryPort) {}
  public execute(input:{readonly context:LifeApplicationContext;readonly childPersonId:string}) {
    return this.query.getCenter(input.context,input.childPersonId);
  }
}

export class CreateChildEducationItemUseCase {
  public constructor(private readonly unit: ChildEducationCoordinationUnitOfWork) {}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:CreateChildEducationItemInput}) {
    const normalized=normalizedCreate(input.context,input.command); if(!normalized.ok)return Promise.resolve(normalized);
    const intent=writeIntent(input.command.itemId,'create',input.command.childPersonId,input.command.visibility);
    return this.unit.execute(input.context,intent,(scope)=>{
      const key=keyFor(input.context,input.command.childPersonId); if(!key.ok)return key;
      const band=childProfile(input.context,scope,input.command.childPersonId); if(!band.ok)return band;
      const zone=privateZone(input.context,band.value,input.command.childPersonId,input.command.visibility); if(!zone.ok)return zone;
      const allowed=authorize(input.context,scope,'create',input.command.itemId,input.command.childPersonId,input.command.visibility); if(!allowed.ok)return allowed;
      const ids=identifiers(input.context,input.command.clientOperationId,input.command.itemId,'item_create',input.command);
      const found=scope.findMutation(key.value,input.command.clientOperationId); if(!found.ok)return found;
      const replayed=replay(input.context,found.value,{kind:'item_create',itemId:input.command.itemId,
        childPersonId:input.command.childPersonId,expectedRevision:0,requestFingerprint:ids.requestFingerprint});
      if(!replayed.ok)return replayed;
      if(replayed.value)return ok(replayed.value);
      const existing=scope.findItem(key.value,input.command.itemId); if(!existing.ok)return existing;
      if(existing.value)return err(conflict(input.context,'Çocuk eğitim öğesi zaten var.'));
      const base=Object.freeze({...normalized.value,familyId:key.value.familyId,childPersonId:key.value.childPersonId,
        privacyExplanationCode:childEducationPrivacyExplanationFor(input.command.visibility),revision:1,
        lastMutationId:ids.mutationId,createdAt:scope.occurredAt,updatedAt:scope.occurredAt});
      const item=Object.freeze({...base,stateFingerprint:itemFingerprint(base)});
      const mutation=mutationRow(input.context,key.value,item,'item_create',input.command.clientOperationId,0,ids,scope.occurredAt);
      return persist(input.context,scope,mutation,item,0,ids.auditId,ids.eventId);
    });
  }
}

export class UpdateChildEducationItemUseCase {
  public constructor(private readonly unit: ChildEducationCoordinationUnitOfWork) {}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:UpdateChildEducationItemInput}) {
    if(!SAFE_ID.test(input.command.clientOperationId)||!SAFE_ID.test(input.command.itemId)||!SAFE_ID.test(input.command.childPersonId)
      ||!Number.isSafeInteger(input.command.expectedRevision)||input.command.expectedRevision<1)
      return Promise.resolve(err(invalid(input.context,'Çocuk eğitim güncelleme kimliği veya revizyonu geçersizdir.')));
    const ids=identifiers(input.context,input.command.clientOperationId,input.command.itemId,'item_update',input.command);
    return this.unit.execute(input.context,writeIntent(input.command.itemId,'update'),(scope)=>{
      const key=keyFor(input.context,input.command.childPersonId); if(!key.ok)return key;
      const foundMutation=scope.findMutation(key.value,input.command.clientOperationId); if(!foundMutation.ok)return foundMutation;
      const replayed=replay(input.context,foundMutation.value,{kind:'item_update',itemId:input.command.itemId,
        childPersonId:input.command.childPersonId,expectedRevision:input.command.expectedRevision,requestFingerprint:ids.requestFingerprint});
      if(!replayed.ok)return replayed;
      if(replayed.value)return ok(replayed.value);
      const found=scope.findItem(key.value,input.command.itemId); if(!found.ok)return found;
      if(!found.value||found.value.status==='deleted')return err(missing(input.context,'Güncellenecek çocuk eğitim öğesi bulunamadı.'));
      if(found.value.revision!==input.command.expectedRevision)return err(conflict(input.context,'Çocuk eğitim öğesi revizyonu değişti.'));
      const band=childProfile(input.context,scope,input.command.childPersonId); if(!band.ok)return band;
      const nextVisibility=input.command.visibility??found.value.visibility;
      const zone=privateZone(input.context,band.value,input.command.childPersonId,nextVisibility); if(!zone.ok)return zone;
      if(found.value.visibility==='adolescent_private'&&input.context.actor.personId!==input.command.childPersonId)
        return err(denied(input.context,'Ergen özel alanı yalnız kayıt sahibi tarafından güncellenebilir.'));
      const allowed=authorize(input.context,scope,'update',input.command.itemId,input.command.childPersonId,found.value.visibility); if(!allowed.ok)return allowed;
      const nextTitle=input.command.title===undefined?ok(found.value.title):text(input.context,input.command.title,'Başlık',2,160); if(!nextTitle.ok)return nextTitle;
      if(input.command.status!==undefined&&!statuses.has(input.command.status))return err(invalid(input.context,'Durum geçersizdir.'));
      const scheduled=input.command.scheduledAt===null?ok(undefined):input.command.scheduledAt===undefined?ok(found.value.scheduledAt):timestamp(input.context,input.command.scheduledAt,'Başlangıç'); if(!scheduled.ok)return scheduled;
      const due=input.command.dueAt===null?ok(undefined):input.command.dueAt===undefined?ok(found.value.dueAt):timestamp(input.context,input.command.dueAt,'Bitiş/vade'); if(!due.ok)return due;
      if(scheduled.value&&due.value&&due.value<scheduled.value)return err(invalid(input.context,'Bitiş/vade başlangıçtan önce olamaz.'));
      const progress=input.command.progressBasisPoints===null?undefined:input.command.progressBasisPoints??found.value.progressBasisPoints;
      if(progress!==undefined&&(!Number.isInteger(progress)||progress<0||progress>10_000))return err(invalid(input.context,'İlerleme 0–10000 baz puan olmalıdır.'));
      const note=input.command.note===null?ok(undefined):input.command.note===undefined?ok(found.value.note):optionalText(input.context,input.command.note,'Not',2000); if(!note.ok)return note;
      const {
        stateFingerprint:_state,
        lastMutationId:_last,
        scheduledAt:_oldScheduled,
        dueAt:_oldDue,
        progressBasisPoints:_oldProgress,
        note:_oldNote,
        ...view
      }=found.value;
      const base=Object.freeze({...view,title:nextTitle.value,status:input.command.status??found.value.status,
        visibility:nextVisibility,privacyExplanationCode:childEducationPrivacyExplanationFor(nextVisibility),
        revision:found.value.revision+1,...(scheduled.value?{scheduledAt:scheduled.value}:{}),
        ...(due.value?{dueAt:due.value}:{}),...(progress===undefined?{}:{progressBasisPoints:progress}),
        ...(note.value?{note:note.value}:{}),lastMutationId:ids.mutationId,updatedAt:scope.occurredAt});
      const item=Object.freeze({...base,stateFingerprint:itemFingerprint(base)});
      const mutation=mutationRow(input.context,key.value,item,'item_update',input.command.clientOperationId,found.value.revision,ids,scope.occurredAt);
      return persist(input.context,scope,mutation,item,found.value.revision,ids.auditId,ids.eventId);
    });
  }
}

export class DeleteChildEducationItemUseCase {
  public constructor(private readonly unit: ChildEducationCoordinationUnitOfWork) {}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:DeleteChildEducationItemInput}) {
    if(!SAFE_ID.test(input.command.clientOperationId)||!SAFE_ID.test(input.command.itemId)||!SAFE_ID.test(input.command.childPersonId)
      ||!Number.isSafeInteger(input.command.expectedRevision)||input.command.expectedRevision<1)
      return Promise.resolve(err(invalid(input.context,'Çocuk eğitim silme kimliği veya revizyonu geçersizdir.')));
    const reason=text(input.context,input.command.reason,'Silme nedeni',2,240); if(!reason.ok)return Promise.resolve(reason);
    const ids=identifiers(input.context,input.command.clientOperationId,input.command.itemId,'item_delete',input.command);
    return this.unit.execute(input.context,writeIntent(input.command.itemId,'delete'),(scope)=>{
      const key=keyFor(input.context,input.command.childPersonId); if(!key.ok)return key;
      const foundMutation=scope.findMutation(key.value,input.command.clientOperationId); if(!foundMutation.ok)return foundMutation;
      const replayed=replay(input.context,foundMutation.value,{kind:'item_delete',itemId:input.command.itemId,
        childPersonId:input.command.childPersonId,expectedRevision:input.command.expectedRevision,requestFingerprint:ids.requestFingerprint});
      if(!replayed.ok)return replayed;
      if(replayed.value)return ok(replayed.value);
      const found=scope.findItem(key.value,input.command.itemId); if(!found.ok)return found;
      if(!found.value||found.value.status==='deleted')return err(missing(input.context,'Silinecek çocuk eğitim öğesi bulunamadı.'));
      if(found.value.revision!==input.command.expectedRevision)return err(conflict(input.context,'Çocuk eğitim öğesi revizyonu değişti.'));
      if(found.value.visibility==='adolescent_private'&&input.context.actor.personId!==input.command.childPersonId)
        return err(denied(input.context,'Ergen özel alanı yalnız kayıt sahibi tarafından silinebilir.'));
      const allowed=authorize(input.context,scope,'delete',input.command.itemId,input.command.childPersonId,found.value.visibility); if(!allowed.ok)return allowed;
      const base=Object.freeze({id:found.value.id,familyId:found.value.familyId,childPersonId:found.value.childPersonId,
        kind:found.value.kind,area:found.value.area,title:'Silindi',status:'deleted' as const,visibility:found.value.visibility,
        privacyExplanationCode:found.value.privacyExplanationCode,revision:found.value.revision+1,
        lastMutationId:ids.mutationId,createdAt:found.value.createdAt,updatedAt:scope.occurredAt,deletedAt:scope.occurredAt});
      const item=Object.freeze({...base,stateFingerprint:itemFingerprint(base)});
      const mutation=mutationRow(input.context,key.value,item,'item_delete',input.command.clientOperationId,found.value.revision,ids,scope.occurredAt);
      return persist(input.context,scope,mutation,item,found.value.revision,ids.auditId,ids.eventId);
    });
  }
}

export const childEducationReadIntent = readIntent;
