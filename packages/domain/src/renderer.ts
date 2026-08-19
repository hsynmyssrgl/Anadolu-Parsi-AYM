import type { IsoDateTime, UserId } from '@ppt/core';

export const asIsoDateTime = (value: string): IsoDateTime => value as IsoDateTime;
export const asUserId = (value: string): UserId => value as UserId;

export {
  USER_VISIBLE_APP_INFO,
  USER_VISIBLE_DELIVERY_FILE_NAME,
  createUserVisibleDeliveryFileName,
  type UserVisibleAppInfo,
  type UserVisibleReleaseChannel
} from './app-meta.js';
export {
  DEFAULT_UI_LOCALIZATION,
  SUPPORTED_UI_LANGUAGES,
  resolveUiLocalization,
  type SupportedUiLanguage,
  type SupportedUiLocale,
  type UiLocalizationBootstrapView
} from './ui-localization.js';
export {
  assessPassword,
  isValidEmail,
  normalizeEmail,
  type PasswordAssessment
} from './validation.js';
export {
  OBJECT_PERMISSION_ACTIONS,
  archiveLegacyOwnershipReattestationConfirmation,
  type ObjectPermissionAction
} from './app-data.js';
export {
  FAMILY_RELATIONSHIP_CATALOG,
  getFamilyRelationship,
  type FamilyRelationshipCategory,
  type FamilyRelationshipCode
} from './family-relationship-catalog.js';
export {
  PRODUCT_NAVIGATION_GROUPS,
  PRODUCT_NAVIGATION_ROUTES,
  type ProductNavigationGroupId,
  type ProductScreenId,
  type ProductSurfaceKind
} from './product-surface-governance.js';
export {
  TEMPORARY_CREDENTIAL_DISCLOSURE_RULES,
  TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND
} from './identity-access-credentials.js';
export { FAMILY_AI_ASSISTANT_KINDS } from './family-ai-assistant.js';
export { MEMORY_STUDIO_RECORD_KINDS } from './memory-studio.js';
