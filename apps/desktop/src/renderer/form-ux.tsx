import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject
} from 'react';

export type AsyncPanelState = 'empty' | 'loading' | 'offline' | 'error';

export interface AsyncStatePanelProps {
  readonly state: AsyncPanelState;
  readonly title: string;
  readonly message: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void | Promise<void>;
  readonly retryFocusTarget?: RefObject<HTMLElement | null>;
  readonly children?: ReactNode;
  readonly className?: string;
}

const joinClassNames = (...values: Array<string | undefined>): string => values.filter(Boolean).join(' ');

export async function runRetryWithFocus(
  retry: () => void | Promise<void>,
  successTarget?: Pick<HTMLElement, 'focus'> | null,
  failureTarget?: Pick<HTMLElement, 'focus'> | null
): Promise<boolean> {
  try {
    await retry();
    successTarget?.focus();
    return true;
  } catch {
    failureTarget?.focus();
    return false;
  }
}

/** A single, screen-reader announced state surface for data-backed views. */
export function AsyncStatePanel({
  state,
  title,
  message,
  retryLabel = 'Yeniden dene',
  onRetry,
  retryFocusTarget,
  children,
  className
}: AsyncStatePanelProps) {
  const retryRef = useRef<HTMLButtonElement>(null);
  const [retrying, setRetrying] = useState(false);
  const urgent = state === 'error' || state === 'offline';

  const retry = useCallback(async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await runRetryWithFocus(onRetry, retryFocusTarget?.current, retryRef.current);
    } finally {
      setRetrying(false);
    }
  }, [onRetry, retryFocusTarget, retrying]);

  return (
    <section
      className={joinClassNames('async-state-panel', `async-state-panel--${state}`, className)}
      data-async-state={state}
      aria-busy={state === 'loading' || retrying}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      role={urgent ? 'alert' : 'status'}
    >
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
      {onRetry && state !== 'loading' ? (
        <button className="async-state-panel__retry" ref={retryRef} type="button" onClick={() => void retry()} disabled={retrying}>
          {retrying ? 'Deneniyor…' : retryLabel}
        </button>
      ) : null}
    </section>
  );
}

export interface ValidationIssue {
  readonly fieldId: string;
  readonly message: string;
}

const cssEscape = (value: string): string => {
  const escape = globalThis.CSS?.escape;
  return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
};

export function focusInvalidField(
  fieldId: string,
  root: Pick<Document, 'getElementById'> | ParentNode = document
): boolean {
  const field = 'getElementById' in root
    ? root.getElementById(fieldId)
    : root.querySelector<HTMLElement>(`#${cssEscape(fieldId)}`);
  if (!field || typeof (field as HTMLElement).focus !== 'function') return false;
  field.focus();
  field.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return true;
}

export function focusFirstInvalid(
  issues: readonly ValidationIssue[],
  root: Pick<Document, 'getElementById'> | ParentNode = document
): boolean {
  const first = issues[0];
  return first ? focusInvalidField(first.fieldId, root) : false;
}

export interface ValidationSummaryProps {
  readonly issues: readonly ValidationIssue[];
  readonly title?: string;
  readonly className?: string;
  readonly focusRequestKey?: string | number;
}

export const shouldFocusValidationSummary = (
  previousIssueCount: number,
  issueCount: number,
  focusRequested = false
): boolean => issueCount > 0 && (focusRequested || previousIssueCount === 0);

export function ValidationSummary({
  issues,
  title = 'Lütfen aşağıdaki alanları düzeltin',
  className,
  focusRequestKey
}: ValidationSummaryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const previousIssueCountRef = useRef(0);
  const previousFocusRequestKeyRef = useRef(focusRequestKey);
  useEffect(() => {
    const focusRequested = focusRequestKey !== undefined
      && focusRequestKey !== previousFocusRequestKeyRef.current;
    if (shouldFocusValidationSummary(previousIssueCountRef.current, issues.length, focusRequested)) {
      headingRef.current?.focus();
    }
    previousIssueCountRef.current = issues.length;
    previousFocusRequestKeyRef.current = focusRequestKey;
  }, [focusRequestKey, issues.length]);
  if (issues.length === 0) return null;

  const followLink = (event: MouseEvent<HTMLAnchorElement>, fieldId: string) => {
    event.preventDefault();
    focusInvalidField(fieldId);
  };

  return (
    <section className={joinClassNames('validation-summary', className)} role="alert" aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>{title}</h2>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.fieldId}:${index}`}>
            <a href={`#${encodeURIComponent(issue.fieldId)}`} onClick={(event) => followLink(event, issue.fieldId)}>
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type GovernedDraftPhase = 'idle' | 'dirty' | 'invalid' | 'saving' | 'saved' | 'error';

export const canUndoGovernedDraft = (phase: GovernedDraftPhase): boolean => phase === 'idle' || phase === 'saved';

export interface GovernedDraftState {
  readonly phase: GovernedDraftPhase;
  readonly sequence: number;
  readonly error?: unknown;
}

export interface GovernedDraftSaveContext {
  readonly sequence: number;
  readonly signal: AbortSignal;
}

export interface GovernedDraftOptions<T> {
  readonly debounceMs?: number;
  readonly validate?: (draft: T) => readonly ValidationIssue[];
  readonly save: (draft: T, context: GovernedDraftSaveContext) => void | Promise<void>;
  readonly onStateChange?: (state: GovernedDraftState) => void;
}

/**
 * In-memory debounce primitive. Each async completion is fenced by a monotonically
 * increasing sequence. It deliberately has no Web Storage integration.
 */
export class GovernedDraftController<T> {
  #draft: T;
  #state: GovernedDraftState = { phase: 'idle', sequence: 0 };
  #timer: ReturnType<typeof setTimeout> | undefined;
  #active: AbortController | undefined;
  #disposed = false;

  public constructor(initialDraft: T, readonly options: GovernedDraftOptions<T>) {
    if (!Number.isFinite(options.debounceMs ?? 500) || (options.debounceMs ?? 500) < 0) {
      throw new Error('Taslak gecikmesi sıfır veya pozitif olmalıdır.');
    }
    this.#draft = initialDraft;
  }

  public get draft(): T { return this.#draft; }
  public get state(): GovernedDraftState { return this.#state; }

  public update(draft: T): void {
    this.#assertActive();
    this.#draft = draft;
    this.#invalidateWork();
    const invalid = (this.options.validate?.(draft).length ?? 0) > 0;
    this.#publish({ phase: invalid ? 'invalid' : 'dirty', sequence: this.#state.sequence + 1 });
    if (invalid) return;
    const scheduledSequence = this.#state.sequence;
    this.#timer = setTimeout(() => void this.#save(scheduledSequence), this.options.debounceMs ?? 500);
  }

  public async flush(): Promise<boolean> {
    this.#assertActive();
    if (this.#state.phase !== 'dirty' && this.#state.phase !== 'error') return false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    return this.#save(this.#state.sequence);
  }

  public retry(): Promise<boolean> { return this.flush(); }

  public reset(draft: T): void {
    this.#assertActive();
    this.#draft = draft;
    this.#invalidateWork();
    this.#publish({ phase: 'idle', sequence: this.#state.sequence + 1 });
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#invalidateWork();
    this.#disposed = true;
  }

  async #save(sequence: number): Promise<boolean> {
    if (this.#disposed || sequence !== this.#state.sequence) return false;
    this.#timer = undefined;
    const operation = new AbortController();
    this.#active?.abort();
    this.#active = operation;
    this.#publish({ phase: 'saving', sequence });
    try {
      await this.options.save(this.#draft, { sequence, signal: operation.signal });
      if (this.#disposed || operation.signal.aborted || sequence !== this.#state.sequence) return false;
      this.#active = undefined;
      this.#publish({ phase: 'saved', sequence });
      return true;
    } catch (error) {
      if (this.#disposed || operation.signal.aborted || sequence !== this.#state.sequence) return false;
      this.#active = undefined;
      this.#publish({ phase: 'error', sequence, error });
      return false;
    }
  }

  #invalidateWork(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#active?.abort();
    this.#active = undefined;
  }

  #publish(state: GovernedDraftState): void {
    this.#state = state;
    this.options.onStateChange?.(state);
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('Taslak denetleyicisi kapatıldı.');
  }
}

export interface GovernedDraftBinding<T> {
  readonly draft: T;
  readonly state: GovernedDraftState;
  readonly setDraft: (draft: T) => void;
  readonly flush: () => Promise<boolean>;
  readonly retry: () => Promise<boolean>;
  readonly reset: (draft: T) => void;
}

export function useGovernedDraft<T>(initialDraft: T, options: GovernedDraftOptions<T>): GovernedDraftBinding<T> {
  const saveRef = useRef(options.save);
  const validateRef = useRef(options.validate);
  const onStateChangeRef = useRef(options.onStateChange);
  saveRef.current = options.save;
  validateRef.current = options.validate;
  onStateChangeRef.current = options.onStateChange;
  const [draft, setDraftState] = useState(initialDraft);
  const [state, setState] = useState<GovernedDraftState>({ phase: 'idle', sequence: 0 });
  const controller = useMemo(() => new GovernedDraftController(initialDraft, {
    ...(options.debounceMs === undefined ? {} : { debounceMs: options.debounceMs }),
    validate: (value) => validateRef.current?.(value) ?? [],
    save: (value, context) => saveRef.current(value, context),
    onStateChange: (next) => {
      setState(next);
      onStateChangeRef.current?.(next);
    }
  }), [options.debounceMs]);

  useEffect(() => () => controller.dispose(), [controller]);
  const setDraft = useCallback((value: T) => { setDraftState(value); controller.update(value); }, [controller]);
  const reset = useCallback((value: T) => { setDraftState(value); controller.reset(value); }, [controller]);

  return {
    draft,
    state,
    setDraft,
    flush: useCallback(() => controller.flush(), [controller]),
    retry: useCallback(() => controller.retry(), [controller]),
    reset
  };
}
