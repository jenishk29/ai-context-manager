// ============================================================================
// Context Event Management Types
// ============================================================================

export type ContextEventStatus = 'started' | 'completed' | 'aborted' | 'pending';

export interface ContextEvent {
  event_id: string;
  timestamp: string; // ISO8601
  user_id?: string;
  tool_id: string;
  operation: string;
  status: ContextEventStatus;
  context_data: Record<string, unknown>;
  tokens_used: number;
  notes: string;
}

export interface ExportError {
  error_code: string;
  message: string;
}

export interface ContextExport {
  context_history: ContextEvent[];
  token_savings: number;
  errors: ExportError[];
}

export interface PrunePolicy {
  max_events?: number;
  max_age_days?: number;
  drop_statuses?: ContextEventStatus[];
}

export interface ContextManagerOptions {
  storagePath?: string;
  inMemory?: boolean;
  user_id?: string;
  tool_id?: string;
  prunePolicy?: PrunePolicy;
  tokenEstimator?: (value: unknown) => number;
}

export interface GetHistoryOptions {
  order?: 'desc' | 'asc';
  limit?: number;
  tool_id?: string;
  user_id?: string;
  operation?: string;
  status?: ContextEventStatus;
}

export interface ValidateAccuracyOptions {
  expected_operations?: string[];
  expected_pending?: number;
}

// ============================================================================
// CLI & Snapshot Generation Types
// ============================================================================

export interface ProjectConfig {
  name: string;
  stack: string[];
  description?: string;
  environment?: {
    languageVersion?: string;
    frameworkVersions?: string[];
    runtimeNotes?: string;
  };
}

export interface ProgressConfig {
  completed?: string[];
  inProgress?: string[];
  nextSteps?: string[];
  blockers?: string[];
}

export interface ActiveTask {
  description?: string;
  relevantFiles?: string[];
  steps?: string[];
  codeHints?: string[];
}

export interface ArchitectureConfig {
  overview?: string;
  patterns?: string[];
  constraints?: string[];
  protectedAreas?: string[];
}

export interface ReadBudget {
  maxRelevantFiles?: number;
  allowExtraReads?: boolean;
}

export interface OptionsConfig {
  maxTokens?: number;
  format?: 'json' | 'md' | 'both';
  includeGit?: boolean;
  readBudget?: ReadBudget;
}

export interface AiContextManagerConfig {
  schemaVersion: string;
  project: ProjectConfig;
  progress: ProgressConfig;
  activeTask: ActiveTask;
  architecture: ArchitectureConfig;
  options: OptionsConfig;
}

export interface GitContext {
  branch?: string;
  tracking?: string;
  lastCommit?: string;
  status?: string;
  stats?: {
    commits?: number;
    contributors?: number;
  };
}

export interface FileContent {
  path: string;
  content: string;
}

export interface HandoffData {
  project: ProjectConfig;
  progress: ProgressConfig;
  activeTask: ActiveTask;
  architecture: ArchitectureConfig;
  tree: string;
  gitContext?: GitContext;
  relevantFiles: FileContent[];
  tokenEstimate: number;
  generatedAt: string;
}

export type LogLevel = 'quiet' | 'normal' | 'verbose' | 'debug';

export interface SnapshotOptions {
  dryRun?: boolean;
  format?: 'json' | 'md' | 'both';
  copy?: boolean;
  force?: boolean;
  output?: string;
}

export interface SecretScanResult {
  found: boolean;
  count: number;
  files: string[];
  patterns: string[];
}
