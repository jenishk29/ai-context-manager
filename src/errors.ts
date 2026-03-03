import type { ExportError } from './types';

export const ERROR_CODES = Object.freeze({
  INVALID_EVENT_DATA: 'INVALID_EVENT_DATA',
  INVALID_EXPORT_FORMAT: 'INVALID_EXPORT_FORMAT',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  DUPLICATE_EVENT_ID: 'DUPLICATE_EVENT_ID',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  INVALID_ARGUMENTS: 'INVALID_ARGUMENTS',
});

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ContextEventsErrorInput {
  error_code: string;
  message: string;
  cause?: unknown;
}

export class ContextEventsError extends Error {
  public readonly error_code: string;
  public readonly cause?: unknown;

  constructor(input: ContextEventsErrorInput) {
    super(input.message);
    this.name = 'ContextEventsError';
    this.error_code = input.error_code;
    if (input.cause) {
      this.cause = input.cause;
    }
  }

  toExportError(): ExportError {
    return { error_code: this.error_code, message: this.message };
  }
}
