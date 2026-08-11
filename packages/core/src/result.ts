
export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export const ok = <TValue>(value: TValue): Result<TValue, never> => ({
  ok: true,
  value
});

export const err = <TError>(error: TError): Result<never, TError> => ({
  ok: false,
  error
});

export const isOk = <TValue, TError>(result: Result<TValue, TError>): result is { readonly ok: true; readonly value: TValue } => result.ok;

export const isErr = <TValue, TError>(result: Result<TValue, TError>): result is { readonly ok: false; readonly error: TError } => !result.ok;

export const mapResult = <TValue, TMapped, TError>(
  result: Result<TValue, TError>,
  mapper: (value: TValue) => TMapped
): Result<TMapped, TError> => (result.ok ? ok(mapper(result.value)) : result);

export const mapError = <TValue, TError, TMappedError>(
  result: Result<TValue, TError>,
  mapper: (error: TError) => TMappedError
): Result<TValue, TMappedError> => (result.ok ? result : err(mapper(result.error)));

export const flatMapResult = <TValue, TMapped, TError>(
  result: Result<TValue, TError>,
  mapper: (value: TValue) => Result<TMapped, TError>
): Result<TMapped, TError> => (result.ok ? mapper(result.value) : result);

export const matchResult = <TValue, TError, TOutput>(
  result: Result<TValue, TError>,
  handlers: {
    readonly ok: (value: TValue) => TOutput;
    readonly err: (error: TError) => TOutput;
  }
): TOutput => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

export const fromThrowable = <TValue, TError>(
  operation: () => TValue,
  mapThrown: (error: unknown) => TError
): Result<TValue, TError> => {
  try {
    return ok(operation());
  } catch (error) {
    return err(mapThrown(error));
  }
};
