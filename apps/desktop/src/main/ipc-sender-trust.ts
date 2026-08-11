export type IpcSenderTrustFailureReason =
  | 'TRUSTED_RENDERER_UNAVAILABLE'
  | 'SENDER_ID_MISMATCH'
  | 'SENDER_FRAME_MISSING'
  | 'SUBFRAME_REJECTED'
  | 'SENDER_URL_INVALID'
  | 'SENDER_DOCUMENT_MISMATCH';

export interface TrustedRendererDescriptor {
  readonly webContentsId: number;
  readonly documentUrl: string;
}

export interface IpcSenderFrameLike {
  readonly url?: string;
}

export interface IpcSenderWebContentsLike {
  readonly id?: number;
  readonly mainFrame?: IpcSenderFrameLike;
}

export interface IpcSenderEventLike {
  readonly sender?: IpcSenderWebContentsLike;
  readonly senderFrame?: IpcSenderFrameLike;
}

export type IpcSenderTrustDecision =
  | { readonly trusted: true }
  | { readonly trusted: false; readonly reason: IpcSenderTrustFailureReason };

const loopbackHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);

const parseUrl = (value: string): URL | undefined => {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

const canonicalDocumentUrl = (value: string): string | undefined => {
  const parsed = parseUrl(value);
  if (!parsed) return undefined;
  if (parsed.username || parsed.password) return undefined;
  if (!['file:', 'http:', 'https:'].includes(parsed.protocol)) return undefined;
  parsed.hash = '';
  return parsed.toString();
};

export const normalizeTrustedRendererDocumentUrl = (
  value: string,
  options: { readonly allowLocalDevelopmentServer: boolean }
): string => {
  const parsed = parseUrl(value);
  if (!parsed) throw new Error('Renderer URL geçerli bir mutlak URL olmalıdır.');
  if (parsed.username || parsed.password) throw new Error('Renderer URL kullanıcı bilgisi içeremez.');
  if (parsed.protocol === 'file:') {
    parsed.hash = '';
    return parsed.toString();
  }
  if (!options.allowLocalDevelopmentServer || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Renderer URL yalnızca file: veya izin verilmiş yerel geliştirme http(s) kaynağı olabilir.');
  }
  if (!loopbackHostnames.has(parsed.hostname)) {
    throw new Error('Geliştirme renderer URL kaynağı yalnızca loopback host kullanabilir.');
  }
  parsed.hash = '';
  return parsed.toString();
};

export const isTrustedRendererDocument = (actualUrl: string, expectedUrl: string): boolean => {
  const actual = canonicalDocumentUrl(actualUrl);
  const expected = canonicalDocumentUrl(expectedUrl);
  return actual !== undefined && expected !== undefined && actual === expected;
};

export const isSafeExternalHttpsUrl = (value: string): boolean => {
  const parsed = parseUrl(value);
  return Boolean(parsed && parsed.protocol === 'https:' && !parsed.username && !parsed.password);
};

export const evaluateIpcSenderTrust = (
  event: IpcSenderEventLike,
  trustedRenderer: TrustedRendererDescriptor | undefined
): IpcSenderTrustDecision => {
  if (!trustedRenderer) return { trusted: false, reason: 'TRUSTED_RENDERER_UNAVAILABLE' };
  if (event.sender?.id !== trustedRenderer.webContentsId) {
    return { trusted: false, reason: 'SENDER_ID_MISMATCH' };
  }
  if (!event.senderFrame) return { trusted: false, reason: 'SENDER_FRAME_MISSING' };
  if (!event.sender?.mainFrame || event.senderFrame !== event.sender.mainFrame) {
    return { trusted: false, reason: 'SUBFRAME_REJECTED' };
  }
  if (typeof event.senderFrame.url !== 'string' || !canonicalDocumentUrl(event.senderFrame.url)) {
    return { trusted: false, reason: 'SENDER_URL_INVALID' };
  }
  if (!isTrustedRendererDocument(event.senderFrame.url, trustedRenderer.documentUrl)) {
    return { trusted: false, reason: 'SENDER_DOCUMENT_MISMATCH' };
  }
  return { trusted: true };
};
