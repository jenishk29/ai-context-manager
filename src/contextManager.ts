import { assertValidEvent, assertValidExport } from './validate';
import { estimateTokensFromJson } from './token';
import { readJsonIfExists, writeJsonAtomic } from './storage';
import { ERROR_CODES, ContextEventsError } from './errors';
import {
  isoNow,
  generateEventId,
  sortByTimestampAsc,
  sortByTimestampDesc,
  normalizeStoragePath,
  cloneJson,
} from './utils';
import type {
  ContextEvent,
  ContextExport,
  ExportError,
  PrunePolicy,
  ContextManagerOptions,
  GetHistoryOptions,
  ValidateAccuracyOptions,
} from './types';

interface Metrics {
  baseline_tokens_ever: number;
  updated_at: string;
}

export class ContextManager {
  private readonly _inMemory: boolean;
  private readonly _storagePath: string;
  private readonly _metricsPath: string;
  private readonly _defaultUserId?: string;
  private readonly _defaultToolId?: string;
  private readonly _tokenEstimator: (value: unknown) => number;
  private readonly _prunePolicy: Required<PrunePolicy>;
  private _events: ContextEvent[];
  private _errors: ExportError[];
  private _baselineTokensEver: number;

  /**
   * @param options Configuration options
   * @param options.storagePath Default: ".context-events/context.json"
   * @param options.inMemory If true, disables persistence.
   * @param options.user_id Optional default user id.
   * @param options.tool_id Optional default tool id (used when adding events if not provided).
   * @param options.prunePolicy Pruning configuration
   * @param options.prunePolicy.max_events Default: 500
   * @param options.prunePolicy.max_age_days Default: 90
   * @param options.prunePolicy.drop_statuses Default: ['aborted']
   * @param options.tokenEstimator Override token estimator.
   */
  constructor(options: ContextManagerOptions = {}) {
    const {
      storagePath = '.context-events/context.json',
      inMemory = false,
      user_id,
      tool_id,
      prunePolicy,
      tokenEstimator,
    } = options;

    this._inMemory = Boolean(inMemory);
    this._storagePath = normalizeStoragePath(storagePath);
    this._metricsPath = this._storagePath.replace(/context\.json$/i, 'metrics.json');
    this._defaultUserId = user_id;
    this._defaultToolId = tool_id;
    this._tokenEstimator = tokenEstimator || estimateTokensFromJson;

    this._prunePolicy = {
      max_events: prunePolicy?.max_events ?? 500,
      max_age_days: prunePolicy?.max_age_days ?? 90,
      drop_statuses: (prunePolicy?.drop_statuses ?? ['aborted']),
    };

    this._events = [];
    this._errors = [];
    this._baselineTokensEver = 0;

    if (!this._inMemory) {
      const loaded = readJsonIfExists(this._storagePath);
      if (loaded) {
        try {
          assertValidExport(loaded);
          this._events = (loaded).context_history;
        } catch (err) {
          // Keep running, but surface the import error via export format.
          this._errors.push(this._toExportError(err));
          this._events = [];
        }
      }

      const metrics = readJsonIfExists(this._metricsPath);
      if (metrics && typeof (metrics as Metrics).baseline_tokens_ever === 'number') {
        this._baselineTokensEver = (metrics as Metrics).baseline_tokens_ever;
      } else {
        // Start with "no savings" baseline equal to current stored size.
        this._baselineTokensEver = this._tokenEstimator({
          context_history: cloneJson(this._events),
          token_savings: 0,
          errors: [],
        });
      }
    }
  }

  /**
   * Add a new context event.
   * Required: tool_id, operation, status, context_data, tokens_used, notes.
   * event_id and timestamp may be provided; if omitted they are generated.
   *
   * @param input Event data
   * @returns The created event
   */
  addEvent(input: Partial<ContextEvent>): ContextEvent {
    const event: ContextEvent = {
      event_id: input.event_id || generateEventId(),
      timestamp: input.timestamp || isoNow(),
      user_id: input.user_id ?? this._defaultUserId,
      tool_id: input.tool_id ?? this._defaultToolId ?? '',
      operation: input.operation ?? '',
      status: input.status ?? 'pending',
      context_data: input.context_data ?? {},
      tokens_used: typeof input.tokens_used === 'number' ? input.tokens_used : 0,
      notes: typeof input.notes === 'string' ? input.notes : '',
    };

    if (!event.tool_id || !event.operation || !event.status || event.context_data == null) {
      throw new ContextEventsError({
        error_code: ERROR_CODES.INVALID_EVENT_DATA,
        message:
          'Missing required fields: tool_id, operation, status, context_data (and ideally notes/tokens_used).',
      });
    }

    if (this._events.some((e) => e.event_id === event.event_id)) {
      throw new ContextEventsError({
        error_code: ERROR_CODES.DUPLICATE_EVENT_ID,
        message: `Duplicate event_id: ${event.event_id}`,
      });
    }

    assertValidEvent(event);
    this._events.push(event);
    this._events.sort(sortByTimestampAsc);

    // Baseline tracks "naive logging" without pruning.
    this._baselineTokensEver += this._tokenEstimator(event);
    this.prune(this._prunePolicy);
    this._persist();
    return event;
  }

  /**
   * Update an existing event by event_id.
   * @param event_id The event ID to update
   * @param patch Partial event data to merge
   * @returns The updated event
   */
  updateEvent(event_id: string, patch: Partial<ContextEvent>): ContextEvent {
    const idx = this._events.findIndex((e) => e.event_id === event_id);
    if (idx === -1) {
      throw new ContextEventsError({
        error_code: ERROR_CODES.EVENT_NOT_FOUND,
        message: `Event not found: ${event_id}`,
      });
    }

    const updated = { ...this._events[idx], ...cloneJson(patch) };
    assertValidEvent(updated);
    this._events[idx] = updated;
    this._events.sort(sortByTimestampAsc);

    this.prune(this._prunePolicy);
    this._persist();
    return updated;
  }

  /**
   * Mark an event as aborted while retaining partial context.
   * @param event_id The event ID to abort
   * @param opts Optional notes to append
   * @returns The updated event
   */
  abortEvent(event_id: string, opts: { notes?: string } = {}): ContextEvent {
    const extra = opts.notes ? ` ${opts.notes}` : '';
    return this.updateEvent(event_id, {
      status: 'aborted',
      notes: `${this._getEventNotes(event_id)}${extra}`.trim(),
    });
  }

  /**
   * Remove an event entirely (hard delete).
   * @param event_id The event ID to remove
   */
  removeEvent(event_id: string): void {
    const before = this._events.length;
    this._events = this._events.filter((e) => e.event_id !== event_id);
    if (this._events.length === before) {
      throw new ContextEventsError({
        error_code: ERROR_CODES.EVENT_NOT_FOUND,
        message: `Event not found: ${event_id}`,
      });
    }
    this._persist();
  }

  /**
   * Roll back the log to a specific event_id by removing newer entries.
   * @param event_id The event ID to roll back to
   * @param opts Options for rollback behavior
   */
  rollbackToEvent(
    event_id: string,
    opts: { preserve_removed_as_aborted?: boolean } = {}
  ): void {
    const idx = this._events.findIndex((e) => e.event_id === event_id);
    if (idx === -1) {
      throw new ContextEventsError({
        error_code: ERROR_CODES.EVENT_NOT_FOUND,
        message: `Event not found: ${event_id}`,
      });
    }

    if (opts.preserve_removed_as_aborted) {
      for (let i = idx + 1; i < this._events.length; i++) {
        this._events[i] = {
          ...this._events[i],
          status: 'aborted',
          notes: `${this._events[i].notes} rolled back`.trim(),
        };
      }
      this._persist();
      return;
    }

    this._events = this._events.slice(0, idx + 1);
    this._persist();
  }

  /**
   * Retrieve ordered history (most recent first by default).
   * @param opts Filter and ordering options
   * @returns Filtered and ordered events
   */
  getHistory(opts: GetHistoryOptions = {}): ContextEvent[] {
    const { order = 'desc', limit, tool_id, user_id, operation, status } = opts;
    let events = [...this._events];

    if (tool_id) {
      events = events.filter((e) => e.tool_id === tool_id);
    }
    if (user_id) {
      events = events.filter((e) => e.user_id === user_id);
    }
    if (operation) {
      events = events.filter((e) => e.operation === operation);
    }
    if (status) {
      events = events.filter((e) => e.status === status);
    }

    events.sort(order === 'asc' ? sortByTimestampAsc : sortByTimestampDesc);
    if (typeof limit === 'number') {
      events = events.slice(0, limit);
    }
    return events;
  }

  /**
   * Export full context in the required JSON format.
   * This method ALWAYS returns:
   * { context_history, token_savings, errors }
   *
   * @param opts Export options
   * @returns Export data conforming to schema
   */
  export(opts: { prune?: boolean } = {}): ContextExport {
    const prune = opts.prune !== false;

    const viewEvents = prune
      ? this._prunedView(this._events, this._prunePolicy)
      : cloneJson(this._events);
    const result: ContextExport = {
      context_history: viewEvents,
      token_savings: 0,
      errors: cloneJson(this._errors),
    };

    const actualTokens = this._tokenEstimator(result);
    result.token_savings = Math.max(0, this._baselineTokensEver - actualTokens);
    assertValidExport(result);
    return result;
  }

  /**
   * Import an exported blob. Mode:
   * - replace: overwrite current state
   * - merge: merge in new events (by event_id)
   *
   * @param data The export data to import
   * @param opts Import options
   */
  import(data: unknown, opts: { mode?: 'replace' | 'merge' } = {}): void {
    const mode = opts.mode || 'replace';
    assertValidExport(data);

    const incoming: ContextEvent[] = cloneJson((data as ContextExport).context_history);

    if (mode === 'replace') {
      this._events = incoming;
      this._events.sort(sortByTimestampAsc);
      this._errors = [];
      this._baselineTokensEver = this._tokenEstimator({
        context_history: cloneJson(this._events),
        token_savings: 0,
        errors: [],
      });
      this.prune(this._prunePolicy);
      this._persist();
      return;
    }

    if (mode !== 'merge') {
      throw new ContextEventsError({
        error_code: ERROR_CODES.INVALID_ARGUMENTS,
        message: `Unknown import mode: ${String(mode)}`,
      });
    }

    const existingIds = new Set(this._events.map((e) => e.event_id));
    for (const evt of incoming) {
      if (existingIds.has(evt.event_id)) {
        throw new ContextEventsError({
          error_code: ERROR_CODES.DUPLICATE_EVENT_ID,
          message: `Duplicate event_id during merge: ${evt.event_id}`,
        });
      }
      this._events.push(evt);
      existingIds.add(evt.event_id);
      this._baselineTokensEver += this._tokenEstimator(evt);
    }
    this._events.sort(sortByTimestampAsc);
    this.prune(this._prunePolicy);
    this._persist();
  }

  /**
   * Prune stale/unnecessary context.
   * @param policy Pruning policy to apply
   */
  prune(policy: PrunePolicy = {}): void {
    const merged: Required<PrunePolicy> = {
      max_events: policy.max_events ?? this._prunePolicy.max_events,
      max_age_days: policy.max_age_days ?? this._prunePolicy.max_age_days,
      drop_statuses: (policy.drop_statuses ?? this._prunePolicy.drop_statuses),
    };
    this._events = this._prunedView(this._events, merged);
    this._persist();
  }

  /**
   * Validate intended vs logged state (basic accuracy utility).
   * @param expected Expected state to validate against
   * @returns Validation result with any errors
   */
  validateAccuracy(expected: ValidateAccuracyOptions = {}): ContextExport {
    const errors: ExportError[] = [];
    if (expected.expected_operations) {
      const ops = new Set(this._events.map((e) => e.operation));
      for (const op of expected.expected_operations) {
        if (!ops.has(op)) {
          errors.push({
            error_code: 'MISSING_EXPECTED_OPERATION',
            message: `Missing expected operation in history: ${op}`,
          });
        }
      }
    }

    if (typeof expected.expected_pending === 'number') {
      const pending = this._events.filter(
        (e) => e.status === 'pending' || e.status === 'started'
      ).length;
      if (pending !== expected.expected_pending) {
        errors.push({
          error_code: 'PENDING_COUNT_MISMATCH',
          message: `Expected pending/started count ${expected.expected_pending}, got ${pending}`,
        });
      }
    }

    return {
      context_history: cloneJson(this._events),
      token_savings: this.export({ prune: false }).token_savings,
      errors,
    };
  }

  /**
   * Clear accumulated operational errors.
   */
  clearErrors(): void {
    this._errors = [];
    this._persist();
  }

  private _getEventNotes(event_id: string): string {
    const e = this._events.find((x) => x.event_id === event_id);
    return e ? e.notes : '';
  }

  private _prunedView(
    events: ContextEvent[],
    policy: Required<PrunePolicy>
  ): ContextEvent[] {
    const now = Date.now();
    const maxAgeMs = policy.max_age_days * 24 * 60 * 60 * 1000;
    const dropStatuses = new Set(policy.drop_statuses || []);

    let kept = events.filter((e) => {
      const ageMs = now - new Date(e.timestamp).getTime();
      if (Number.isFinite(ageMs) && ageMs > maxAgeMs && dropStatuses.has(e.status)) {
        return false;
      }
      return true;
    });

    // Cap by count: drop oldest first.
    kept.sort(sortByTimestampAsc);
    if (kept.length > policy.max_events) {
      kept = kept.slice(kept.length - policy.max_events);
    }
    return kept;
  }

  private _toExportError(err: unknown): ExportError {
    if (err && typeof err === 'object' && 'error_code' in err && 'message' in err) {
      const errObj = err as { error_code: string; message: string };
      return {
        error_code: errObj.error_code,
        message: errObj.message,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error_code: ERROR_CODES.SCHEMA_VALIDATION_FAILED, message };
  }

  private _persist(): void {
    if (this._inMemory) {
      return;
    }
    const report = this.export({ prune: true });
    writeJsonAtomic(this._storagePath, report);
    writeJsonAtomic(this._metricsPath, {
      baseline_tokens_ever: this._baselineTokensEver,
      updated_at: isoNow(),
    });
  }
}
