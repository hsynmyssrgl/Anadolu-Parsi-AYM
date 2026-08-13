import { describe, expect, it } from 'vitest';
import {
  ACCESSIBILITY_PROFILE_PRESETS,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  accessibilityAnnouncement,
  applyAccessibilityProfile,
  nextRovingIndex,
  parseAccessibilityPreferences,
  resolveAccessibilityTheme,
  serializeAccessibilityPreferences
} from '../src/renderer/accessibility.js';

describe('33-M accessibility preference center', () => {
  it('starts from safe system signals without granting operating-system write authority', () => {
    expect(parseAccessibilityPreferences(null, { highContrast:true, reduceMotion:true })).toMatchObject({
      textScale:'standard', textScalePercent:100, highContrast:true, reduceMotion:true,
      theme:'system', density:'standard', readingMode:'standard', audienceProfile:'standard',
      captionsEnabled:true, audioMuted:false
    });
  });

  it('fails closed to bounded values for malformed local bootstrap data', () => {
    expect(parseAccessibilityPreferences(JSON.stringify({
      textScale:'huge', textScalePercent:999, theme:'remote', density:'hidden',
      readingMode:'unsafe', audienceProfile:'impersonated', captionsEnabled:'yes', audioMuted:1
    }))).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
    expect(parseAccessibilityPreferences('{')).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
  });

  it('accepts every inclusive custom scale from 100 through 225 only as an integer', () => {
    expect(parseAccessibilityPreferences('{"textScalePercent":100}').textScalePercent).toBe(100);
    expect(parseAccessibilityPreferences('{"textScalePercent":225}').textScalePercent).toBe(225);
    expect(parseAccessibilityPreferences('{"textScalePercent":99}').textScalePercent).toBe(100);
    expect(parseAccessibilityPreferences('{"textScalePercent":225.5}').textScalePercent).toBe(100);
  });

  it('provides all audience profiles while compact mode never encodes hidden data', () => {
    expect(Object.keys(ACCESSIBILITY_PROFILE_PRESETS)).toEqual(['youth','standard','senior','low-vision','caregiver']);
    expect(applyAccessibilityProfile('senior')).toMatchObject({textScale:'large',density:'comfortable',readingMode:'easy-read'});
    expect(applyAccessibilityProfile('low-vision')).toMatchObject({textScalePercent:200,highContrast:true});
    expect(ACCESSIBILITY_PROFILE_PRESETS.standard.density).toBe('standard');
  });

  it('round trips the exact governed preference shape', () => {
    const value=applyAccessibilityProfile('caregiver',{highContrast:true,reduceMotion:true});
    expect(parseAccessibilityPreferences(serializeAccessibilityPreferences(value))).toEqual(value);
  });

  it('resolves system theme locally and preserves explicit light or dark choice', () => {
    expect(resolveAccessibilityTheme('system',true)).toBe('dark');
    expect(resolveAccessibilityTheme('system',false)).toBe('light');
    expect(resolveAccessibilityTheme('light',true)).toBe('light');
  });

  it('keeps keyboard roving and Turkish route announcements deterministic', () => {
    expect(nextRovingIndex(0,4,'ArrowUp')).toBe(3);
    expect(nextRovingIndex(3,4,'ArrowDown')).toBe(0);
    expect(nextRovingIndex(2,4,'Home')).toBe(0);
    expect(accessibilityAnnouncement('Sağlık')).toBe('Sağlık bölümü açıldı.');
  });
});
