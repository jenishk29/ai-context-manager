import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ContextEventsError, ERROR_CODES } from './errors';
import type { ContextEvent, ContextExport } from './types';

// Import schemas
import contextEventSchema from '../schemas/context_event.schema.json';
import exportSchema from '../schemas/export.schema.json';

/**
 * AJV strict mode is enabled (requirement: "Function schemas must use strict: true").
 * - strict: true -> throw on unknown keywords, etc.
 * - allErrors: true -> report all issues.
 */
function buildAjv(): Ajv {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
    messages: true,
  });
  addFormats(ajv);

  // Ensure referenced schemas resolve.
  // export.schema.json references context_event.schema.json via relative $ref.
  // AJV resolves relative refs based on $id; we set absolute ids in both schemas.
  // Still, we add them explicitly for robustness.
  ajv.addSchema(contextEventSchema, contextEventSchema.$id || 'ContextEvent');
  ajv.addSchema(exportSchema, exportSchema.$id || 'ContextExport');
  return ajv;
}

const ajv = buildAjv();
const validateEvent = ajv.compile(contextEventSchema);
const validateExport = ajv.compile(exportSchema);

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors || []).map((e) => {
    const at = e.instancePath || '(root)';
    return `${at} ${e.message || ''}`.trim();
  });
}

export function assertValidEvent(event: unknown): asserts event is ContextEvent {
  const ok = validateEvent(event);
  if (!ok) {
    throw new ContextEventsError({
      error_code: ERROR_CODES.INVALID_EVENT_DATA,
      message: `Event failed schema validation: ${formatAjvErrors(validateEvent.errors).join('; ')}`,
    });
  }
}

export function assertValidExport(data: unknown): asserts data is ContextExport {
  const ok = validateExport(data);
  if (!ok) {
    throw new ContextEventsError({
      error_code: ERROR_CODES.INVALID_EXPORT_FORMAT,
      message: `Export failed schema validation: ${formatAjvErrors(validateExport.errors).join('; ')}`,
    });
  }
}
