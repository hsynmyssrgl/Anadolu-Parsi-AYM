// Compatibility re-export only. Family schema SQL is owned by @ppt/database.
export {
  FAMILY_DATABASE_MIGRATIONS,
  FAMILY_DATABASE_MIGRATIONS as DATABASE_MIGRATIONS,
  FamilyDatabaseMigrationError,
  LEGACY_MVP40_SCHEMA_FINGERPRINT,
  MVP54_APPLICATION_SCHEMA_FINGERPRINT,
  MVP55_APPLICATION_SCHEMA_FINGERPRINT,
  MVP56_APPLICATION_SCHEMA_FINGERPRINT,
  runFamilyDatabaseMigrations,
  type RunFamilyDatabaseMigrationsInput
} from '@ppt/database';
