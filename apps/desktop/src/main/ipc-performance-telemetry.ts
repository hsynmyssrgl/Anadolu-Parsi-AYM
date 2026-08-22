import { resolveIpcRequestAdmissionPolicy, type IpcRequestAdmissionPriority } from './ipc-request-lifecycle.js';

export type IpcPerformanceTelemetryTerminalKind =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'timeout'
  | 'queue-full'
  | 'queue-timeout'
  | 'cache-hit';

export interface IpcPerformanceTelemetryRecordInput {
  readonly channel: string;
  readonly kind: IpcPerformanceTelemetryTerminalKind;
  readonly durationMs?: number;
  readonly queueWaitMs?: number;
  readonly activeCount?: number;
  readonly queuedCount?: number;
  readonly cacheStored?: boolean;
  readonly observedAt?: number;
}

export interface IpcPerformanceTelemetryChannelView {
  readonly channel: string;
  readonly priority: IpcRequestAdmissionPriority;
  readonly sampleCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly cancelledCount: number;
  readonly timeoutCount: number;
  readonly queueFullCount: number;
  readonly queueTimeoutCount: number;
  readonly cacheHitCount: number;
  readonly cacheStoreCount: number;
  readonly averageDurationMs: number;
  readonly p95DurationMs: number;
  readonly maxDurationMs: number;
  readonly averageQueueWaitMs: number;
  readonly p95QueueWaitMs: number;
  readonly maxQueueWaitMs: number;
  readonly peakActiveCount: number;
  readonly peakQueuedCount: number;
  readonly cacheHitRatePercent: number;
  readonly lastObservedAt: string;
}

export interface IpcPerformanceTelemetryAlertView {
  readonly code: 'duration-p95' | 'queue-wait-p95' | 'timeout-rate' | 'queue-rejection-rate' | 'global-pressure';
  readonly severity: 'warning' | 'critical';
  readonly channel?: string;
  readonly metric: string;
  readonly value: number;
  readonly threshold: number;
  readonly message: string;
  readonly detectedAt: string;
}

export interface IpcPerformanceTelemetryView {
  readonly generatedAt: string;
  readonly windowMinutes: number;
  readonly maxSamplesPerChannel: number;
  readonly totalSamples: number;
  readonly activeRequests: number;
  readonly queuedRequests: number;
  readonly cacheEntries: number;
  readonly channels: readonly IpcPerformanceTelemetryChannelView[];
  readonly alerts: readonly IpcPerformanceTelemetryAlertView[];
}

interface Sample {
  readonly kind: IpcPerformanceTelemetryTerminalKind;
  readonly durationMs: number;
  readonly queueWaitMs: number;
  readonly activeCount: number;
  readonly queuedCount: number;
  readonly cacheStored: boolean;
  readonly observedAt: number;
}

const CHANNEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*:[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*$/;
const clampMetric = (value: number | undefined, max: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(Number(value) * 100) / 100));
};
const average = (values: readonly number[]): number => values.length
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100
  : 0;
const percentile = (values: readonly number[], ratio: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Math.round((sorted[index] ?? 0) * 100) / 100;
};
const percent = (value: number, total: number): number => total > 0
  ? Math.round(value / total * 10_000) / 100
  : 0;

const thresholdsFor = (priority: IpcRequestAdmissionPriority): { durationWarning: number; durationCritical: number; queueWarning: number; queueCritical: number } => {
  if (priority === 'interactive') return { durationWarning: 1_500, durationCritical: 4_000, queueWarning: 750, queueCritical: 2_500 };
  if (priority === 'background') return { durationWarning: 12_000, durationCritical: 30_000, queueWarning: 5_000, queueCritical: 9_000 };
  return { durationWarning: 3_500, durationCritical: 10_000, queueWarning: 2_000, queueCritical: 5_000 };
};

export class IpcPerformanceTelemetryRegistry {
  readonly #samplesByChannel = new Map<string, Sample[]>();
  readonly #windowMs: number;
  readonly #maxSamplesPerChannel: number;
  readonly #maxChannels: number;

  public constructor(input: { windowMinutes?: number; maxSamplesPerChannel?: number; maxChannels?: number } = {}) {
    const windowMinutes = Math.trunc(input.windowMinutes ?? 60);
    const maxSamplesPerChannel = Math.trunc(input.maxSamplesPerChannel ?? 256);
    const maxChannels = Math.trunc(input.maxChannels ?? 64);
    this.#windowMs = Math.min(24 * 60, Math.max(5, windowMinutes)) * 60_000;
    this.#maxSamplesPerChannel = Math.min(2_048, Math.max(32, maxSamplesPerChannel));
    this.#maxChannels = Math.min(256, Math.max(16, maxChannels));
  }

  public record(input: IpcPerformanceTelemetryRecordInput): boolean {
    if (typeof input.channel !== 'string' || input.channel.length > 128 || !CHANNEL_PATTERN.test(input.channel)) return false;
    const observedAt = Number.isFinite(input.observedAt) ? Math.max(0, Number(input.observedAt)) : Date.now();
    let samples = this.#samplesByChannel.get(input.channel);
    if (!samples) {
      if (this.#samplesByChannel.size >= this.#maxChannels) this.#evictOldestChannel();
      samples = [];
      this.#samplesByChannel.set(input.channel, samples);
    }
    this.#prune(samples, observedAt);
    samples.push(Object.freeze({
      kind: input.kind,
      durationMs: clampMetric(input.durationMs, 24 * 60 * 60_000),
      queueWaitMs: clampMetric(input.queueWaitMs, 24 * 60 * 60_000),
      activeCount: Math.trunc(clampMetric(input.activeCount, 10_000)),
      queuedCount: Math.trunc(clampMetric(input.queuedCount, 10_000)),
      cacheStored: input.cacheStored === true,
      observedAt
    }));
    if (samples.length > this.#maxSamplesPerChannel) samples.splice(0, samples.length - this.#maxSamplesPerChannel);
    return true;
  }

  public snapshot(input: { activeRequests: number; queuedRequests: number; cacheEntries: number; now?: number }): IpcPerformanceTelemetryView {
    const now = Number.isFinite(input.now) ? Math.max(0, Number(input.now)) : Date.now();
    const channels: IpcPerformanceTelemetryChannelView[] = [];
    for (const [channel, samples] of this.#samplesByChannel.entries()) {
      this.#prune(samples, now);
      if (!samples.length) {
        this.#samplesByChannel.delete(channel);
        continue;
      }
      channels.push(this.#summarizeChannel(channel, samples));
    }
    channels.sort((left, right) => right.p95DurationMs - left.p95DurationMs || right.sampleCount - left.sampleCount || left.channel.localeCompare(right.channel));
    const activeRequests = Math.trunc(clampMetric(input.activeRequests, 10_000));
    const queuedRequests = Math.trunc(clampMetric(input.queuedRequests, 10_000));
    const cacheEntries = Math.trunc(clampMetric(input.cacheEntries, 100_000));
    const generatedAt = new Date(now).toISOString();
    return Object.freeze({
      generatedAt,
      windowMinutes: this.#windowMs / 60_000,
      maxSamplesPerChannel: this.#maxSamplesPerChannel,
      totalSamples: channels.reduce((sum, channel) => sum + channel.sampleCount, 0),
      activeRequests,
      queuedRequests,
      cacheEntries,
      channels: Object.freeze(channels),
      alerts: Object.freeze(this.#alerts(channels, activeRequests, queuedRequests, generatedAt))
    });
  }

  public clear(): void {
    this.#samplesByChannel.clear();
  }

  #summarizeChannel(channel: string, samples: readonly Sample[]): IpcPerformanceTelemetryChannelView {
    const durations = samples.filter((sample) => ['success', 'failure', 'cancelled', 'timeout', 'cache-hit'].includes(sample.kind)).map((sample) => sample.durationMs);
    const queueWaits = samples.filter((sample) => sample.queueWaitMs > 0).map((sample) => sample.queueWaitMs);
    const successCount = samples.filter((sample) => sample.kind === 'success' || sample.kind === 'cache-hit').length;
    const cacheHitCount = samples.filter((sample) => sample.kind === 'cache-hit').length;
    const lastObservedAt = Math.max(...samples.map((sample) => sample.observedAt));
    return Object.freeze({
      channel,
      priority: resolveIpcRequestAdmissionPolicy(channel).priority,
      sampleCount: samples.length,
      successCount,
      failureCount: samples.filter((sample) => sample.kind === 'failure').length,
      cancelledCount: samples.filter((sample) => sample.kind === 'cancelled').length,
      timeoutCount: samples.filter((sample) => sample.kind === 'timeout').length,
      queueFullCount: samples.filter((sample) => sample.kind === 'queue-full').length,
      queueTimeoutCount: samples.filter((sample) => sample.kind === 'queue-timeout').length,
      cacheHitCount,
      cacheStoreCount: samples.filter((sample) => sample.cacheStored).length,
      averageDurationMs: average(durations),
      p95DurationMs: percentile(durations, 0.95),
      maxDurationMs: durations.length ? Math.max(...durations) : 0,
      averageQueueWaitMs: average(queueWaits),
      p95QueueWaitMs: percentile(queueWaits, 0.95),
      maxQueueWaitMs: queueWaits.length ? Math.max(...queueWaits) : 0,
      peakActiveCount: Math.max(...samples.map((sample) => sample.activeCount), 0),
      peakQueuedCount: Math.max(...samples.map((sample) => sample.queuedCount), 0),
      cacheHitRatePercent: percent(cacheHitCount, successCount),
      lastObservedAt: new Date(lastObservedAt).toISOString()
    });
  }

  #alerts(channels: readonly IpcPerformanceTelemetryChannelView[], activeRequests: number, queuedRequests: number, detectedAt: string): IpcPerformanceTelemetryAlertView[] {
    const alerts: IpcPerformanceTelemetryAlertView[] = [];
    for (const channel of channels) {
      const thresholds = thresholdsFor(channel.priority);
      if (channel.p95DurationMs >= thresholds.durationWarning) {
        const critical = channel.p95DurationMs >= thresholds.durationCritical;
        alerts.push(Object.freeze({
          code: 'duration-p95', severity: critical ? 'critical' : 'warning', channel: channel.channel,
          metric: 'p95DurationMs', value: channel.p95DurationMs,
          threshold: critical ? thresholds.durationCritical : thresholds.durationWarning,
          message: `${channel.channel} kanalında p95 yanıt süresi ${critical ? 'kritik' : 'yüksek'}.`, detectedAt
        }));
      }
      if (channel.p95QueueWaitMs >= thresholds.queueWarning) {
        const critical = channel.p95QueueWaitMs >= thresholds.queueCritical;
        alerts.push(Object.freeze({
          code: 'queue-wait-p95', severity: critical ? 'critical' : 'warning', channel: channel.channel,
          metric: 'p95QueueWaitMs', value: channel.p95QueueWaitMs,
          threshold: critical ? thresholds.queueCritical : thresholds.queueWarning,
          message: `${channel.channel} kanalında p95 kuyruk beklemesi ${critical ? 'kritik' : 'yüksek'}.`, detectedAt
        }));
      }
      if (channel.sampleCount >= 10) {
        const timeoutRate = percent(channel.timeoutCount, channel.sampleCount);
        if (timeoutRate >= 5) alerts.push(Object.freeze({
          code: 'timeout-rate', severity: timeoutRate >= 15 ? 'critical' : 'warning', channel: channel.channel,
          metric: 'timeoutRatePercent', value: timeoutRate, threshold: 5,
          message: `${channel.channel} kanalında süre aşımı oranı yüksek.`, detectedAt
        }));
        const rejectionRate = percent(channel.queueFullCount + channel.queueTimeoutCount, channel.sampleCount);
        if (rejectionRate >= 10) alerts.push(Object.freeze({
          code: 'queue-rejection-rate', severity: rejectionRate >= 25 ? 'critical' : 'warning', channel: channel.channel,
          metric: 'queueRejectionRatePercent', value: rejectionRate, threshold: 10,
          message: `${channel.channel} kanalında geri basınç ret oranı yüksek.`, detectedAt
        }));
      }
    }
    if (activeRequests >= 8 || queuedRequests >= 12) alerts.push(Object.freeze({
      code: 'global-pressure', severity: activeRequests >= 16 || queuedRequests >= 24 ? 'critical' : 'warning',
      metric: queuedRequests >= 12 ? 'queuedRequests' : 'activeRequests',
      value: queuedRequests >= 12 ? queuedRequests : activeRequests,
      threshold: queuedRequests >= 12 ? 12 : 8,
      message: 'IPC işlem katmanında genel istek baskısı yüksek.', detectedAt
    }));
    return alerts.sort((left, right) => (left.severity === right.severity ? 0 : left.severity === 'critical' ? -1 : 1) || right.value - left.value).slice(0, 24);
  }

  #prune(samples: Sample[], now: number): void {
    const cutoff = now - this.#windowMs;
    let removeCount = 0;
    while (removeCount < samples.length && (samples[removeCount]?.observedAt ?? now) < cutoff) removeCount += 1;
    if (removeCount > 0) samples.splice(0, removeCount);
  }

  #evictOldestChannel(): void {
    let oldestKey: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [channel, samples] of this.#samplesByChannel.entries()) {
      const observedAt = samples.at(-1)?.observedAt ?? 0;
      if (observedAt < oldestAt) { oldestAt = observedAt; oldestKey = channel; }
    }
    if (oldestKey) this.#samplesByChannel.delete(oldestKey);
  }
}
