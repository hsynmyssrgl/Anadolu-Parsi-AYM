import { describe, expect, it } from 'vitest';
import {
  FAMILY_DATABASE_MIGRATIONS,
  FAMILY_DATABASE_SCHEMA_GENERATION
} from './src/family-database-migrations.js';

const LEGACY_POLICY_RECEIPT_TRIGGERS = Object.freeze([
  'trg_b5_family_emergency_policy_receipt',
  'trg_b5_emergency_preparedness_policy_receipt',
  'trg_b5_emergency_assistance_policy_receipt',
  'trg_b5_emergency_card_portability_policy_receipt',
  'trg_ltp_mutation_policy_receipt',
  'trg_accessibility_mutation_policy_receipt',
  'trg_form_draft_mutation_policy_receipt'
]);

describe('migration 121 authoritative policy receipt time', () => {
  it('replaces every legacy trigger with the authoritative receipt recorded time', () => {
    const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 121);
    expect(migration).toBeDefined();
    expect(migration?.name).toBe('authoritative_policy_receipt_recorded_at');
    expect(migration?.sql).toContain(FAMILY_DATABASE_SCHEMA_GENERATION);

    for (const triggerName of LEGACY_POLICY_RECEIPT_TRIGGERS) {
      expect(migration?.sql).toContain(`DROP TRIGGER IF EXISTS ${triggerName};`);
      expect(migration?.sql).toContain(`CREATE TRIGGER ${triggerName}`);
    }

    expect(migration?.sql.match(/receipt\.recorded_at=NEW\.created_at/g)).toHaveLength(
      LEGACY_POLICY_RECEIPT_TRIGGERS.length
    );
    expect(migration?.sql).not.toContain("json_extract(receipt.record_json,'$.request.occurredAt')");
  });
});
