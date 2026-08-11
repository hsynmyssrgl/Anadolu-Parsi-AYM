export type SensitiveLogMetadataClass =
  | 'IDENTIFIER'
  | 'SHA256'
  | 'RESULT'
  | 'CORRELATION'
  | 'COUNTER'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'VERSION';

/** Content-free UI/IPC projection of the PPK-017 logging boundary. */
export interface SensitiveLoggingBoundaryView {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly allowedMetadataClasses: readonly SensitiveLogMetadataClass[];
  readonly maximumMetadataFields: 48;
  readonly maximumTechnicalTokenLength: 160;
  readonly payloadAllowed: false;
  readonly ocrTextAllowed: false;
  readonly arbitraryMessageAllowed: false;
  readonly errorStackAllowed: false;
  readonly persistentPathAllowed: false;
  readonly nestedMetadataAllowed: false;
  readonly diagnosticTextStored: false;
  readonly diagnosticSourceTextHashed: true;
  readonly protectedDesktopSinkRequired: true;
  readonly plaintextDesktopProductionSinkAllowed: false;
  readonly directConsolePrimitiveAllowedOutsideLoggingPackage: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
  readonly payloadExposed: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly cutoverAuthorityAttached: false;
}
