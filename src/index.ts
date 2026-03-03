/**
 * AI Context Manager
 * 
 * Complete AI context management solution — event tracking, snapshot generation,
 * and seamless context handoff between AI tools.
 * 
 * @module ai-context-manager
 */

// ============================================================================
// Event Management API (Library Usage)
// ============================================================================

export { ContextManager } from './contextManager';
export { ContextEventsError, ERROR_CODES, type ErrorCode } from './errors';
export type {
  ContextEvent,
  ContextEventStatus,
  ContextExport,
  ExportError,
  PrunePolicy,
  ContextManagerOptions,
  GetHistoryOptions,
  ValidateAccuracyOptions,
  // CLI & Snapshot types
  ProjectConfig,
  ProgressConfig,
  ActiveTask,
  ArchitectureConfig,
  ReadBudget,
  OptionsConfig,
  ContextBridgeConfig,
  GitContext,
  FileContent,
  HandoffData,
  LogLevel,
  SnapshotOptions,
  SecretScanResult,
} from './types';

// ============================================================================
// Schemas Export
// ============================================================================

import contextEventSchema from '../schemas/context_event.schema.json';
import exportSchema from '../schemas/export.schema.json';
import functionSchemas from '../schemas/function_schemas.json';

export const schemas = {
  context_event: contextEventSchema,
  export: exportSchema,
  functions: functionSchemas,
};

// ============================================================================
// Utilities for Advanced Usage
// ============================================================================

export { estimateTokensFromJson } from './token';
export { readJsonIfExists, writeJsonAtomic, ensureDir } from './storage';
export { 
  isoNow, 
  generateEventId, 
  sortByTimestampDesc, 
  sortByTimestampAsc, 
  normalizeStoragePath,
  cloneJson 
} from './utils';
