import { isTrustedRendererDocument } from './ipc-sender-trust.js';

export type RendererSessionViolationReason =
  | 'UNTRUSTED_NAVIGATION_REJECTED'
  | 'UNTRUSTED_REDIRECT_REJECTED'
  | 'WEBVIEW_ATTACH_REJECTED'
  | 'PERMISSION_REQUEST_REJECTED'
  | 'PERMISSION_CHECK_REJECTED'
  | 'DOWNLOAD_REJECTED';

export const DESKTOP_RENDERER_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export interface RendererSessionViolation {
  readonly reason: RendererSessionViolationReason;
  readonly permission?: string;
}

export interface PreventableEventLike {
  preventDefault(): void;
}

export interface DownloadItemLike {
  cancel?(): void;
}

export interface RendererSessionLike {
  setPermissionRequestHandler(
    handler: (
      webContents: unknown,
      permission: string,
      callback: (allowed: boolean) => void,
      details: unknown
    ) => void
  ): void;
  setPermissionCheckHandler(
    handler: (webContents: unknown, permission: string, requestingOrigin: string, details: unknown) => boolean
  ): void;
  on(
    event: 'will-download',
    listener: (event: PreventableEventLike, item: DownloadItemLike, webContents: unknown) => void
  ): void;
  webRequest?: {
    onHeadersReceived(
      listener: (
        details: { readonly url: string; readonly responseHeaders?: Record<string, string[]> },
        callback: (response: { readonly responseHeaders: Record<string, string[]> }) => void
      ) => void
    ): void;
  };
}

export interface RendererSecurityWebContentsLike {
  readonly session: RendererSessionLike;
  on(
    event: 'will-navigate' | 'will-redirect',
    listener: (event: PreventableEventLike, url: string) => void
  ): void;
  on(
    event: 'will-attach-webview',
    listener: (event: PreventableEventLike, webPreferences: Record<string, unknown>, params: Record<string, unknown>) => void
  ): void;
}

export interface InstallRendererSessionSecurityInput {
  readonly webContents: RendererSecurityWebContentsLike;
  readonly trustedDocumentUrl: string;
  readonly onViolation?: (violation: RendererSessionViolation) => void;
}

const downloadProtectedSessions = new WeakSet<object>();
const headerProtectedSessions = new WeakSet<object>();

const rejectEvent = (
  event: PreventableEventLike,
  reason: RendererSessionViolationReason,
  onViolation: InstallRendererSessionSecurityInput['onViolation']
): void => {
  event.preventDefault();
  onViolation?.({ reason });
};

export const installRendererSessionSecurity = (input: InstallRendererSessionSecurityInput): void => {
  const { webContents, trustedDocumentUrl, onViolation } = input;

  webContents.session.setPermissionRequestHandler((_requestingContents, permission, callback) => {
    callback(false);
    onViolation?.({ reason: 'PERMISSION_REQUEST_REJECTED', permission });
  });

  webContents.session.setPermissionCheckHandler((_requestingContents, permission) => {
    onViolation?.({ reason: 'PERMISSION_CHECK_REJECTED', permission });
    return false;
  });

  if (webContents.session.webRequest && !headerProtectedSessions.has(webContents.session as object)) {
    webContents.session.webRequest.onHeadersReceived((details, callback) => callback({
      responseHeaders: {
        ...(details.responseHeaders ?? {}),
        'Content-Security-Policy': [DESKTOP_RENDERER_CSP]
      }
    }));
    headerProtectedSessions.add(webContents.session as object);
  }

  if (!downloadProtectedSessions.has(webContents.session as object)) {
    webContents.session.on('will-download', (event, item) => {
      event.preventDefault();
      item.cancel?.();
      onViolation?.({ reason: 'DOWNLOAD_REJECTED' });
    });
    downloadProtectedSessions.add(webContents.session as object);
  }

  webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererDocument(url, trustedDocumentUrl)) {
      rejectEvent(event, 'UNTRUSTED_NAVIGATION_REJECTED', onViolation);
    }
  });

  webContents.on('will-redirect', (event, url) => {
    if (!isTrustedRendererDocument(url, trustedDocumentUrl)) {
      rejectEvent(event, 'UNTRUSTED_REDIRECT_REJECTED', onViolation);
    }
  });

  webContents.on('will-attach-webview', (event, webPreferences, params) => {
    event.preventDefault();
    for (const key of Object.keys(webPreferences)) delete webPreferences[key];
    for (const key of Object.keys(params)) delete params[key];
    onViolation?.({ reason: 'WEBVIEW_ATTACH_REJECTED' });
  });
};
