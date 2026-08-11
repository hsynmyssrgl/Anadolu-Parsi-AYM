
declare const brand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type CorrelationId = Brand<string, 'CorrelationId'>;
export type CausationId = Brand<string, 'CausationId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type FamilyId = Brand<string, 'FamilyId'>;
export type HouseholdId = Brand<string, 'HouseholdId'>;
export type FamilyBranchId = Brand<string, 'FamilyBranchId'>;
export type PersonId = Brand<string, 'PersonId'>;
export type UserId = Brand<string, 'UserId'>;
export type EventId = Brand<string, 'EventId'>;
export type AttachmentId = Brand<string, 'AttachmentId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type IsoDate = Brand<string, 'IsoDate'>;
export type IsoDateTime = Brand<string, 'IsoDateTime'>;
export type Sha256 = Brand<string, 'Sha256'>;

export const asBrand = <TValue, TBrand extends string>(
  value: TValue
): Brand<TValue, TBrand> => value as Brand<TValue, TBrand>;

export const asCorrelationId = (value: string): CorrelationId => asBrand<string, 'CorrelationId'>(value);
export const asCausationId = (value: string): CausationId => asBrand<string, 'CausationId'>(value);
export const asCommandId = (value: string): CommandId => asBrand<string, 'CommandId'>(value);
export const asFamilyId = (value: string): FamilyId => asBrand<string, 'FamilyId'>(value);
export const asHouseholdId = (value: string): HouseholdId => asBrand<string, 'HouseholdId'>(value);
export const asFamilyBranchId = (value: string): FamilyBranchId => asBrand<string, 'FamilyBranchId'>(value);
export const asPersonId = (value: string): PersonId => asBrand<string, 'PersonId'>(value);
export const asUserId = (value: string): UserId => asBrand<string, 'UserId'>(value);
export const asEventId = (value: string): EventId => asBrand<string, 'EventId'>(value);
export const asAttachmentId = (value: string): AttachmentId => asBrand<string, 'AttachmentId'>(value);
export const asMembershipId = (value: string): MembershipId => asBrand<string, 'MembershipId'>(value);
export const asIsoDate = (value: string): IsoDate => asBrand<string, 'IsoDate'>(value);
export const asIsoDateTime = (value: string): IsoDateTime => asBrand<string, 'IsoDateTime'>(value);
export const asSha256 = (value: string): Sha256 => asBrand<string, 'Sha256'>(value);
