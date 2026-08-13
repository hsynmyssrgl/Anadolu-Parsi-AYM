import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  LongTermPortfolioAllocationView,
  LongTermPortfolioInstrumentRevisionView,
  LongTermPortfolioLedgerEventView,
  LongTermPortfolioPlanVersionView,
  LongTermPortfolioPriceObservationView,
  LongTermPortfolioPrivacy,
  LongTermPortfolioView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LongTermPortfolioPolicyContext {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: LongTermPortfolioPrivacy;
}

export interface LongTermPortfolioMutationRow extends LongTermPortfolioPolicyContext {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly operation: 'bootstrap_default' | 'instrument_revision' | 'plan_version' | 'ledger_event' | 'price_observation';
  readonly resourceId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioInstrumentRow extends LongTermPortfolioPolicyContext {
  readonly id: string;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioInstrumentRevisionRow extends LongTermPortfolioInstrumentRevisionView, LongTermPortfolioPolicyContext {
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioRow extends LongTermPortfolioView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioPlanVersionRow extends Omit<LongTermPortfolioPlanVersionView,'allocations'>, LongTermPortfolioPolicyContext {
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioAllocationRow extends LongTermPortfolioAllocationView, LongTermPortfolioPolicyContext {
  readonly portfolioId: string;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioPlanSealRow extends LongTermPortfolioPolicyContext {
  readonly planVersionId:string;
  readonly mutationId:string;
  readonly allocationCount:number;
  readonly totalBasisPoints:10000;
  readonly createdAt:IsoDateTime;
}

export interface LongTermPortfolioLedgerEventRow extends LongTermPortfolioLedgerEventView, LongTermPortfolioPolicyContext {
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface LongTermPortfolioPriceObservationRow extends LongTermPortfolioPriceObservationView, LongTermPortfolioPolicyContext {
  readonly portfolioId: string;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export type NewLongTermPortfolioMutationRow = LongTermPortfolioMutationRow;
export type NewLongTermPortfolioInstrumentRow = LongTermPortfolioInstrumentRow;
export type NewLongTermPortfolioInstrumentRevisionRow = LongTermPortfolioInstrumentRevisionRow;
export type NewLongTermPortfolioRow = LongTermPortfolioRow;
export type NewLongTermPortfolioPlanVersionRow = LongTermPortfolioPlanVersionRow;
export type NewLongTermPortfolioAllocationRow = LongTermPortfolioAllocationRow;
export type NewLongTermPortfolioPlanSealRow = LongTermPortfolioPlanSealRow;
export type NewLongTermPortfolioLedgerEventRow = LongTermPortfolioLedgerEventRow;
export type NewLongTermPortfolioPriceObservationRow = LongTermPortfolioPriceObservationRow;

export interface LongTermPortfolioRepository {
  findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,clientOperationId:string):RepositoryResult<LongTermPortfolioMutationRow|null>;
  listPortfolios(context:PolicyAuthorizedRepositoryExecutionContext):RepositoryResult<readonly LongTermPortfolioRow[]>;
  findPortfolio(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioRow|null>;
  listInstrumentRevisions(context:PolicyAuthorizedRepositoryExecutionContext):RepositoryResult<readonly LongTermPortfolioInstrumentRevisionRow[]>;
  findInstrument(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioInstrumentRow|null>;
  findInstrumentRevision(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioInstrumentRevisionRow|null>;
  listPlanVersions(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioPlanVersionRow[]>;
  listAllocations(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioAllocationRow[]>;
  listLedgerEvents(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioLedgerEventRow[]>;
  findLedgerEvent(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioLedgerEventRow|null>;
  listPriceObservations(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioPriceObservationRow[]>;
  insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioMutationRow):RepositoryResult<void>;
  insertInstrument(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioInstrumentRow):RepositoryResult<void>;
  insertInstrumentRevision(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioInstrumentRevisionRow):RepositoryResult<void>;
  insertPortfolio(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioRow):RepositoryResult<void>;
  insertPlanVersion(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPlanVersionRow):RepositoryResult<void>;
  insertAllocation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioAllocationRow):RepositoryResult<void>;
  insertPlanSeal(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPlanSealRow):RepositoryResult<void>;
  insertLedgerEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioLedgerEventRow):RepositoryResult<void>;
  insertPriceObservation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPriceObservationRow):RepositoryResult<void>;
}

export interface LongTermPortfolioAuditOutboxScope {
  appendAudit(input:{readonly id:string;readonly action:string;readonly resourceType:string;readonly resourceId:string;readonly metadata?:Readonly<Record<string,unknown>>}):RepositoryResult<void>;
  enqueueEvent<T>(event:DomainEvent<T>):RepositoryResult<void>;
}
