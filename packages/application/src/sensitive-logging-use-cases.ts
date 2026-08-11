import type { SensitiveLoggingBoundaryView } from '@ppt/domain';
import { SensitiveLogPolicy } from '@ppt/platform-policy';

export class GetSensitiveLoggingBoundaryUseCase {
  public constructor(private readonly policy: SensitiveLogPolicy) {}

  public execute(): SensitiveLoggingBoundaryView {
    const snapshot = this.policy.snapshot();
    return Object.freeze({
      schemaVersion: 1,
      enforcement: snapshot.enforcement,
      allowedMetadataClasses: snapshot.allowedMetadataClasses,
      maximumMetadataFields: snapshot.maximumMetadataFields,
      maximumTechnicalTokenLength: snapshot.maximumTechnicalTokenLength,
      payloadAllowed: snapshot.payloadAllowed,
      ocrTextAllowed: snapshot.ocrTextAllowed,
      arbitraryMessageAllowed: snapshot.arbitraryMessageAllowed,
      errorStackAllowed: snapshot.errorStackAllowed,
      persistentPathAllowed: snapshot.persistentPathAllowed,
      nestedMetadataAllowed: snapshot.nestedMetadataAllowed,
      diagnosticTextStored: snapshot.diagnosticTextStored,
      diagnosticSourceTextHashed: snapshot.diagnosticSourceTextHashed,
      protectedDesktopSinkRequired: snapshot.protectedDesktopSinkRequired,
      plaintextDesktopProductionSinkAllowed: false,
      directConsolePrimitiveAllowedOutsideLoggingPackage: snapshot.directConsolePrimitiveAllowedOutsideLoggingPackage,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77,
      payloadExposed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  }
}
