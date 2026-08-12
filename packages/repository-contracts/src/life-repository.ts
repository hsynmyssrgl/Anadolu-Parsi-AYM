import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  FamilyEmergencyChecklistItemLedgerItemView,
  FamilyEmergencyChecklistStatusLedgerItemView,
  FamilyEmergencyDrillLedgerItemView,
  FamilyEmergencyExternalContactLedgerItemView,
  FamilyEmergencyMeetingPointLedgerItemView,
  FamilyEmergencyMemberStatusLedgerItemView,
  FamilyEmergencyPlanLedgerItemView,
  FamilyEmergencyPreparednessKitCheckLedgerItemView,
  FamilyEmergencyPreparednessKitItemLedgerItemView,
  FamilyEmergencyPreparednessKitLedgerItemView,
  LifeRecordView,
  ManagedHomeInventoryBelongingLedgerItemView,
  ManagedHomeInventoryDocumentLedgerItemView,
  ManagedHomeInventoryMeterLedgerItemView,
  ManagedHomeInventoryMeterReadingLedgerItemView,
  ManagedHomeInventoryRoomLedgerItemView,
  ManagedHomeInventoryServiceLedgerItemView,
  ManagedHomeInventoryWarrantyLedgerItemView,
  ManagedLifeActivityLedgerItemView,
  ManagedLifeDocumentLedgerItemView,
  ManagedLifeProfileLedgerItemView,
  ManagedLifeReminderKind
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LifeRecordRow extends LifeRecordView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly startsAt?: IsoDateTime;
  readonly dueAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export type ManagedLifeProfileLedgerItemRow = ManagedLifeProfileLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly startsAt?: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly initialReminder?: {
    readonly kind: ManagedLifeReminderKind;
    readonly dueAt: IsoDateTime;
  };
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeActivityLedgerItemRow = ManagedLifeActivityLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly occurredAt: IsoDateTime;
  readonly reminderMutation?:
    | { readonly action: 'set'; readonly kind: ManagedLifeReminderKind; readonly dueAt: IsoDateTime }
    | { readonly action: 'clear' };
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeDocumentLedgerItemRow = ManagedLifeDocumentLedgerItemView & {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
};

export type ManagedLifeLedgerItemRow =
  | ManagedLifeProfileLedgerItemRow
  | ManagedLifeActivityLedgerItemRow
  | ManagedLifeDocumentLedgerItemRow;

type ManagedHomeInventoryRowCommon = {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
};

export type ManagedHomeInventoryRoomLedgerItemRow =
  Omit<ManagedHomeInventoryRoomLedgerItemView, 'createdAt'> & ManagedHomeInventoryRowCommon;
export type ManagedHomeInventoryMeterLedgerItemRow =
  Omit<ManagedHomeInventoryMeterLedgerItemView, 'createdAt'> & ManagedHomeInventoryRowCommon;
export type ManagedHomeInventoryMeterReadingLedgerItemRow =
  Omit<ManagedHomeInventoryMeterReadingLedgerItemView, 'createdAt' | 'recordedAt'>
  & ManagedHomeInventoryRowCommon
  & { readonly recordedAt: IsoDateTime };
export type ManagedHomeInventoryBelongingLedgerItemRow =
  Omit<ManagedHomeInventoryBelongingLedgerItemView, 'createdAt' | 'purchasedAt'>
  & ManagedHomeInventoryRowCommon
  & { readonly serialNumber?: string; readonly purchasedAt?: IsoDateTime };
export type ManagedHomeInventoryWarrantyLedgerItemRow =
  Omit<ManagedHomeInventoryWarrantyLedgerItemView, 'createdAt' | 'startsAt' | 'endsAt' | 'reminderAt'>
  & ManagedHomeInventoryRowCommon
  & { readonly startsAt: IsoDateTime; readonly endsAt: IsoDateTime; readonly reminderAt?: IsoDateTime };
export type ManagedHomeInventoryServiceLedgerItemRow =
  Omit<ManagedHomeInventoryServiceLedgerItemView, 'createdAt' | 'occurredAt'>
  & ManagedHomeInventoryRowCommon
  & { readonly occurredAt: IsoDateTime };
export type ManagedHomeInventoryDocumentLedgerItemRow =
  Omit<ManagedHomeInventoryDocumentLedgerItemView, 'createdAt'> & ManagedHomeInventoryRowCommon;
export type ManagedHomeInventoryLedgerItemRow =
  | ManagedHomeInventoryRoomLedgerItemRow
  | ManagedHomeInventoryMeterLedgerItemRow
  | ManagedHomeInventoryMeterReadingLedgerItemRow
  | ManagedHomeInventoryBelongingLedgerItemRow
  | ManagedHomeInventoryWarrantyLedgerItemRow
  | ManagedHomeInventoryServiceLedgerItemRow
  | ManagedHomeInventoryDocumentLedgerItemRow;

type FamilyEmergencyRowCommon = {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
};

export type FamilyEmergencyPlanLedgerItemRow =
  Omit<FamilyEmergencyPlanLedgerItemView, 'ownerPersonId' | 'createdAt'> & FamilyEmergencyRowCommon;
export type FamilyEmergencyMeetingPointLedgerItemRow =
  Omit<FamilyEmergencyMeetingPointLedgerItemView, 'ownerPersonId' | 'createdAt'> & FamilyEmergencyRowCommon;
export type FamilyEmergencyExternalContactLedgerItemRow =
  Omit<FamilyEmergencyExternalContactLedgerItemView, 'ownerPersonId' | 'createdAt'>
  & FamilyEmergencyRowCommon;
export type FamilyEmergencyChecklistItemLedgerItemRow =
  Omit<FamilyEmergencyChecklistItemLedgerItemView, 'ownerPersonId' | 'createdAt'> & FamilyEmergencyRowCommon;
export type FamilyEmergencyChecklistStatusLedgerItemRow =
  Omit<FamilyEmergencyChecklistStatusLedgerItemView, 'ownerPersonId' | 'createdAt'> & FamilyEmergencyRowCommon;
export type FamilyEmergencyMemberStatusLedgerItemRow =
  Omit<
    FamilyEmergencyMemberStatusLedgerItemView,
    'ownerPersonId' | 'memberPersonId' | 'reportedByPersonId' | 'occurredAt' | 'createdAt'
  >
  & FamilyEmergencyRowCommon
  & {
    readonly memberPersonId: PersonId;
    readonly reportedByPersonId: PersonId;
    readonly occurredAt: IsoDateTime;
  };
export type FamilyEmergencyLedgerItemRow =
  | FamilyEmergencyPlanLedgerItemRow
  | FamilyEmergencyMeetingPointLedgerItemRow
  | FamilyEmergencyExternalContactLedgerItemRow
  | FamilyEmergencyChecklistItemLedgerItemRow
  | FamilyEmergencyChecklistStatusLedgerItemRow
  | FamilyEmergencyMemberStatusLedgerItemRow;

type FamilyEmergencyPreparednessRowCommon = {
  readonly familyId:FamilyId;
  readonly ownerPersonId:PersonId;
  readonly createdAt:IsoDateTime;
};
export type FamilyEmergencyPreparednessKitLedgerItemRow =
  Omit<FamilyEmergencyPreparednessKitLedgerItemView, 'ownerPersonId' | 'createdAt'>
  & FamilyEmergencyPreparednessRowCommon;
export type FamilyEmergencyPreparednessKitItemLedgerItemRow =
  Omit<FamilyEmergencyPreparednessKitItemLedgerItemView, 'ownerPersonId' | 'createdAt'>
  & FamilyEmergencyPreparednessRowCommon;
export type FamilyEmergencyPreparednessKitCheckLedgerItemRow =
  Omit<FamilyEmergencyPreparednessKitCheckLedgerItemView, 'ownerPersonId' | 'checkedAt' | 'createdAt'>
  & FamilyEmergencyPreparednessRowCommon
  & { readonly checkedAt:IsoDateTime };
export type FamilyEmergencyDrillLedgerItemRow =
  Omit<FamilyEmergencyDrillLedgerItemView, 'ownerPersonId' | 'occurredAt' | 'createdAt'>
  & FamilyEmergencyPreparednessRowCommon
  & { readonly occurredAt:IsoDateTime };
export type FamilyEmergencyPreparednessLedgerItemRow =
  | FamilyEmergencyPreparednessKitLedgerItemRow
  | FamilyEmergencyPreparednessKitItemLedgerItemRow
  | FamilyEmergencyPreparednessKitCheckLedgerItemRow
  | FamilyEmergencyDrillLedgerItemRow;

export interface LifeRepositoryPort {
  listLifeRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly LifeRecordRow[]>;
  insertLifeRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: LifeRecordRow
  ): RepositoryResult<void>;
  listManagedLifeItems(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly ManagedLifeLedgerItemRow[]>;
  findManagedLifeProfile(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedLifeProfileLedgerItemRow | null>;
  insertManagedLifeItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ManagedLifeLedgerItemRow
  ): RepositoryResult<void>;
  listManagedHomeInventoryItems(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly ManagedHomeInventoryLedgerItemRow[]>;
  findManagedHomeInventoryItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedHomeInventoryLedgerItemRow | null>;
  findLatestManagedHomeMeterReading(
    context: PolicyAuthorizedRepositoryExecutionContext,
    recordId: string,
    meterId: string
  ): RepositoryResult<ManagedHomeInventoryMeterReadingLedgerItemRow | null>;
  insertManagedHomeInventoryItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ManagedHomeInventoryLedgerItemRow
  ): RepositoryResult<void>;
  listFamilyEmergencyItems(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly FamilyEmergencyLedgerItemRow[]>;
  findFamilyEmergencyPlan(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<FamilyEmergencyPlanLedgerItemRow | null>;
  findFamilyEmergencyItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<FamilyEmergencyLedgerItemRow | null>;
  insertFamilyEmergencyItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FamilyEmergencyLedgerItemRow
  ): RepositoryResult<void>;
  listFamilyEmergencyPreparednessItems(
    context:PolicyAuthorizedRepositoryExecutionContext
  ):RepositoryResult<readonly FamilyEmergencyPreparednessLedgerItemRow[]>;
  findFamilyEmergencyPreparednessItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyPreparednessLedgerItemRow | null>;
  insertFamilyEmergencyPreparednessItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyEmergencyPreparednessLedgerItemRow
  ):RepositoryResult<void>;
}

/**
 * Narrow pre-authorization lookup used only by the production LIFE PEP
 * resolver. Business reads and writes remain policy-authorized operations.
 */
export interface LifePolicyResourceRepositoryPort {
  findLifeRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LifeRecordRow | null>;
  findManagedLifeProfileForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedLifeProfileLedgerItemRow | null>;
  findFamilyEmergencyPlanForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FamilyEmergencyPlanLedgerItemRow | null>;
}

export interface LifeAutomationDueProjectionRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt: IsoDateTime;
}

export interface LifeAutomationRunSourceProjectionRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt?: IsoDateTime;
}

export interface LifeReportOverdueProjectionRow extends LifeAutomationDueProjectionRow {
  readonly sourceType: 'life_record';
}

export interface LifeReportProjection {
  readonly activeTasks: number;
  readonly expiringInsurance: number;
  readonly overdueItems: readonly LifeReportOverdueProjectionRow[];
}

/**
 * Receipt-bound LIFE projections for automation and reports. Dashboard
 * aggregation is intentionally not part of this bounded port.
 */
export interface LifeProjectionRepositoryPort {
  listAutomationDueLife(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: { readonly fromAt: IsoDateTime; readonly toAt: IsoDateTime }
  ): RepositoryResult<readonly LifeAutomationDueProjectionRow[]>;
  listVisibleAutomationLifeRunSources(
    context: PolicyAuthorizedRepositoryExecutionContext,
    ids: readonly string[]
  ): RepositoryResult<readonly LifeAutomationRunSourceProjectionRow[]>;
  getLifeReportProjection(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: {
      readonly now: IsoDateTime;
      readonly in30Days: IsoDateTime;
      readonly overdueLimit?: number;
    }
  ): RepositoryResult<LifeReportProjection>;
}
