import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toUserFacingErrorMessage } from '../src/renderer/user-facing-error';

const rendererDirectory = fileURLToPath(new URL('../src/renderer/', import.meta.url));

describe('renderer user-facing error boundary', () => {
  it('fails closed for IPC, policy, storage, stack, path and object transport details', () => {
    const fallback = 'İşlem tamamlanamadı. Lütfen yeniden deneyin.';
    const technicalMessages = [
      "Error invoking remote method 'catalog:listPeople': Error: [object Object]",
      '[CORE-UNEXPECTED-001] SQLite işlemi tamamlanamadı.',
      'PPK-013 repository policy denied the request',
      'PlatformPolicyEnforcementError: Trusted policy connection authority could not be resolved',
      'TypeError: failed\n    at loadCenter (C:\\PPT\\app.ts:42:7)',
      '/home/user/app/database.sqlite dosyasına erişilemedi.',
      'UNKNOWN_IPC_CHANNEL'
    ];

    for (const message of technicalMessages) {
      const visible = toUserFacingErrorMessage(new Error(message), fallback);
      expect(visible).toBe(fallback);
      expect(visible).not.toMatch(/Error invoking remote method|\[object Object\]|CORE-|PPK-|SQL|SQLite|IPC|stack|[A-Za-z]:\\/iu);
    }
  });

  it('preserves short natural Turkish and English validation messages', () => {
    expect(toUserFacingErrorMessage(new Error('Aile adı gereklidir.'), 'Kayıt oluşturulamadı.')).toBe('Aile adı gereklidir.');
    expect(toUserFacingErrorMessage(new Error('The password must contain a symbol.'), 'The record could not be saved.')).toBe(
      'The password must contain a symbol.'
    );
    expect(toUserFacingErrorMessage(new Error('There was an error while checking the form.'), 'The form could not be checked.')).toBe(
      'There was an error while checking the form.'
    );
  });

  it('uses the localized fallback for unknown values and unsafe fallback content', () => {
    expect(toUserFacingErrorMessage({ message: 'secret' }, 'Kayıt oluşturulamadı.')).toBe('Kayıt oluşturulamadı.');
    expect(toUserFacingErrorMessage(new Error('SQLite failed'), 'SQLite C:\\secret\\data.db')).toBe(
      'İşlem tamamlanamadı. Lütfen yeniden deneyin.'
    );
    expect(toUserFacingErrorMessage(new Error('SQLite failed'), 'The SQL operation failed.')).toBe(
      'The operation could not be completed. Please try again.'
    );
  });

  it('does not leave direct caught error messages on the renderer surfaces in scope', () => {
    const files = readdirSync(rendererDirectory)
      .filter((file) => file.endsWith('.tsx'));
    for (const file of files) {
      const source = readFileSync(new URL(`../src/renderer/${file}`, import.meta.url), 'utf8');
      const userFacingExceptionSource = file === 'App.tsx'
        ? source
            .replace('test(caught.message);', '')
            .replace('{e.message}', '')
            .replace('{x.message}', '')
        : source;
      expect(userFacingExceptionSource, file).not.toMatch(/\b(?:caught|error|err|e|x|value)\.message\b/u);
    }
  });
});
