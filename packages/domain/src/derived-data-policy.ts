export type DerivedDataPolicyKind =
  | 'OCR_TEXT'
  | 'SEARCH_INDEX'
  | 'THUMBNAIL'
  | 'AI_MEMORY'
  | 'SUMMARY'
  | 'EMBEDDING'
  | 'TRANSLATION'
  | 'TRANSCRIPT'
  | 'CACHE'
  | 'REPLICA';

/** Content-free UI/IPC projection of the PPK-016 security boundary. */
export interface DerivedDataPolicyBoundaryView {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly supportedKinds: readonly DerivedDataPolicyKind[];
  readonly maximumSourceCount: 32;
  readonly maximumLineageDepth: 16;
  readonly maximumAncestorCount: 512;
  readonly sourcePolicyIntersectionRequired: true;
  readonly sensitivityDowngradeAllowed: false;
  readonly accessBroadeningAllowed: false;
  readonly authorizedRepositoryAdapterCount: 1;
  readonly directAccessExceptionCount: 0;
  readonly payloadExposed: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly cutoverAuthorityAttached: false;
}

export type DerivedDataInheritanceBoundaryView = DerivedDataPolicyBoundaryView;
