import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const valid = {
  expectedRevision: 0,
  clientOperationId: 'accessibility-operation-0001',
  textScale: 'large',
  textScalePercent: 150,
  highContrast: true,
  reduceMotion: true,
  theme: 'system',
  density: 'comfortable',
  readingMode: 'easy-read',
  audienceProfile: 'senior',
  captionsEnabled: true,
  audioMuted: false
} as const;

describe('33-M accessibility preferences IPC boundary', () => {
  it('accepts the exact read and update contracts', () => {
    expect(evaluateIpcIntegrationPolicy('accessibility:getPreferences', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [valid])).toEqual({ accepted: true });
  });

  it('rejects unknown fields, invalid enums and unsafe scale or revision values', () => {
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [{ ...valid, futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [{ ...valid, theme: 'forged' }]))
      .toMatchObject({ accepted: false, reason: 'ACCESSIBILITY_PREFERENCES_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [{ ...valid, textScalePercent: 99 }]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [{ ...valid, expectedRevision: -1 }]))
      .toMatchObject({ accepted: false });
  });

  it('rejects nested secrets and argument-shape drift', () => {
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', [{ ...valid, cvv: '123' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('accessibility:getPreferences', ['extra']))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('accessibility:updatePreferences', []))
      .toMatchObject({ accepted: false });
  });
});
