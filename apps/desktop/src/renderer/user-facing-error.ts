const MAX_USER_MESSAGE_LENGTH = 280;

const TECHNICAL_MESSAGE_PATTERNS: readonly RegExp[] = Object.freeze([
  /error invoking remote method/iu,
  /\[object Object\]/iu,
  /\b(?:CORE|PPK)-[A-Z0-9_-]+\b/iu,
  /\b(?:SQL|SQLite)\b/iu,
  /\b(?:IPC|database|repository|stack(?:\s+trace)?|TypeError|ReferenceError|SyntaxError|AggregateError|UnhandledPromiseRejection)\b/iu,
  /\b(?:electron|node):[A-Za-z0-9_./-]+\b/iu,
  /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/u,
  /\[[A-Z][A-Z0-9_-]{2,}\]/u,
  /(?:^|\s)at\s+(?:async\s+)?[\w.$<>]+\s*(?:\([^)]*:\d+:\d+\)|[^\s]+:\d+:\d+)/u,
  /\b[A-Za-z]:[\\/][^\s]*/u,
  /\\\\[A-Za-z0-9._$-]+[\\/]/u,
  /(?:^|\s)\/(?:Users|home|var|tmp|etc|opt|usr|private|Applications|Program Files)\//iu,
  /(?:^|\s)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/u,
  /\b[a-z][\w.-]*:[a-z][\w.-]*\b/u,
  /[{[]\s*"[^"]+"\s*:/u,
  /^\s*(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*Error\s*:/u,
  /^\s*(?:Error|TypeError|ReferenceError|SyntaxError|AggregateError)\s*:/iu
]);

const normalizeMessage = (value: string): string => value.normalize('NFKC').trim().replace(/ {2,}/gu, ' ');

const isSafeNaturalMessage = (value: string): boolean => {
  if (!value || value.length > MAX_USER_MESSAGE_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  return TECHNICAL_MESSAGE_PATTERNS.every((pattern) => !pattern.test(value));
};

const safeFallback = (fallback: string): string => {
  const normalized = normalizeMessage(fallback);
  if (isSafeNaturalMessage(normalized)) return normalized;
  return /\b(?:the|could|please|try|unable|failed)\b/iu.test(normalized)
    ? 'The operation could not be completed. Please try again.'
    : 'İşlem tamamlanamadı. Lütfen yeniden deneyin.';
};

export const toUserFacingErrorMessage = (caught: unknown, fallback: string): string => {
  const candidate = caught instanceof Error ? caught.message : typeof caught === 'string' ? caught : '';
  const normalized = normalizeMessage(candidate);
  return isSafeNaturalMessage(normalized) ? normalized : safeFallback(fallback);
};
