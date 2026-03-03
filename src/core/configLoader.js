'use strict';

/**
 * Config Loader — Loads, validates, and resolves .ai-context-manager.json
 *
 * Security: Uses JSON (not JS) config to prevent arbitrary code execution.
 * Validates against JSON Schema with ajv.
 * Merges user exclude patterns with hardcoded security exclusions.
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { readFileUTF8 } = require('../utils/platform');
const { logger } = require('../utils/logger');

const CONFIG_FILENAME = '.ai-context-manager.json';
const CONTEXTBRIDGE_DIR = '.ai-context-manager';

// Schema loaded once
const configSchema = require('../schemas/config.schema.json');

// Hardcoded security exclusions — ALWAYS applied, cannot be overridden
const SECURITY_EXCLUSIONS = [
  // Environment / secrets
  '.env', '.env.*', '.env.local', '.env.development', '.env.production',
  '.env.staging', '.env.test',

  // Certificates and keys
  '*.pem', '*.key', '*.cert', '*.crt', '*.p12', '*.pfx',
  'id_rsa', 'id_rsa.*', 'id_ed25519', 'id_ed25519.*', 'id_ecdsa', 'id_ecdsa.*',

  // Cloud credentials
  'credentials.json', 'service-account.json', 'service-account-key.json',

  // Package manager auth
  '.npmrc', '.yarnrc', '.pypirc', '.gem/credentials',

  // Docker secrets
  '.docker/config.json',

  // Terraform state
  'terraform.tfstate', 'terraform.tfstate.backup', '*.tfvars',

  // Databases
  '*.sqlite', '*.sqlite3', '*.db',

  // Common secrets files
  'secrets.json', 'secrets.yaml', 'secrets.yml',
  '.secrets', '*.secret',

  // IDE and OS
  '.idea/', '.vscode/settings.json', '.DS_Store', 'Thumbs.db',

  // Build outputs and dependencies
  'node_modules/', '.git/', 'dist/', 'build/', 'out/', 'target/',
  '__pycache__/', '*.pyc', '*.pyo', '.tox/', '.venv/', 'venv/',
  'vendor/', 'bin/', 'obj/',

  // Lock files (large, not useful in handoff)
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Pipfile.lock', 'poetry.lock', 'Gemfile.lock', 'composer.lock',
  'Cargo.lock', 'go.sum',

  // AI Context Manager's own output
  '.ai-context-manager/',
];

/**
 * Find the config file by searching the given dir and optionally upward.
 * Returns the absolute path or null.
 */
function findConfigFile(startDir, customPath) {
  if (customPath) {
    const resolved = path.resolve(startDir, customPath);
    if (fs.existsSync(resolved)) return resolved;
    return null;
  }

  // Look in the current directory
  const configPath = path.join(startDir, CONFIG_FILENAME);
  if (fs.existsSync(configPath)) return configPath;

  return null;
}

/**
 * Load, parse, and validate the config file.
 * Returns { config, configPath, projectRoot, errors }.
 */
function loadConfig(startDir, customPath) {
  const configPath = findConfigFile(startDir, customPath);

  if (!configPath) {
    return {
      config: null,
      configPath: null,
      projectRoot: startDir,
      errors: [`Config file not found. Run 'acm init' first.`],
    };
  }

  const projectRoot = path.dirname(configPath);

  // Parse JSON
  let rawConfig;
  try {
    const content = readFileUTF8(configPath);
    rawConfig = JSON.parse(content);
  } catch (err) {
    return {
      config: null,
      configPath,
      projectRoot,
      errors: [`Failed to parse ${CONFIG_FILENAME}: ${err.message}`],
    };
  }

  // Validate against schema
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  addFormats(ajv);
  const validate = ajv.compile(configSchema);
  const valid = validate(rawConfig);

  if (!valid) {
    const errors = validate.errors.map((e) => {
      const path = e.instancePath || '(root)';
      return `  ${path}: ${e.message}`;
    });
    return {
      config: null,
      configPath,
      projectRoot,
      errors: [`Config validation failed:\n${errors.join('\n')}`],
    };
  }

  // Apply defaults for optional fields
  const config = applyDefaults(rawConfig);

  // Merge security exclusions into exclude list
  config._mergedExclude = mergeExclusions(config.exclude || []);

  return { config, configPath, projectRoot, errors: [] };
}

/**
 * Apply defaults for optional fields not covered by JSON Schema defaults.
 */
function applyDefaults(config) {
  return {
    schemaVersion: config.schemaVersion || '1.0',
    project: {
      name: config.project?.name || 'unnamed-project',
      stack: config.project?.stack || [],
      description: config.project?.description || '',
      environment: {
        languageVersion: config.project?.environment?.languageVersion || '',
        frameworkVersions: config.project?.environment?.frameworkVersions || [],
        runtimeNotes: config.project?.environment?.runtimeNotes || '',
      },
    },
    progress: {
      completed: config.progress?.completed || [],
      inProgress: config.progress?.inProgress || [],
      nextSteps: config.progress?.nextSteps || [],
      blockers: config.progress?.blockers || [],
      lastUpdated: config.progress?.lastUpdated || null,
    },
    activeTask: {
      description: config.activeTask?.description || '',
      relevantFiles: config.activeTask?.relevantFiles || [],
      steps: config.activeTask?.steps || [],
      codeHints: config.activeTask?.codeHints || [],
    },
    architecture: {
      overview: config.architecture?.overview || '',
      patterns: config.architecture?.patterns || [],
      constraints: config.architecture?.constraints || [],
      protectedAreas: config.architecture?.protectedAreas || [],
    },
    exclude: config.exclude || [],
    options: {
      maxTokens: config.options?.maxTokens || 8000,
      format: config.options?.format || 'both',
      treeDepth: config.options?.treeDepth || 4,
      maxTreeEntries: config.options?.maxTreeEntries || 200,
      includeGit: config.options?.includeGit !== false,
      gitLogCount: config.options?.gitLogCount || 5,
      readBudget: {
        maxRelevantFiles: config.options?.readBudget?.maxRelevantFiles || 4,
        allowExtraReads:
          typeof config.options?.readBudget?.allowExtraReads === 'boolean'
            ? config.options.readBudget.allowExtraReads
            : true,
      },
    },
  };
}

/**
 * Merge user exclude patterns with security exclusions.
 * Security exclusions always take priority.
 */
function mergeExclusions(userExcludes) {
  const merged = new Set(SECURITY_EXCLUSIONS);
  for (const pattern of userExcludes) {
    merged.add(pattern);
  }
  return [...merged];
}

/**
 * Check if progress fields are stale (older than threshold).
 * Returns { stale: boolean, ageHours: number, lastUpdated: string|null }
 */
function checkStaleness(config, thresholdHours = 24) {
  const lastUpdated = config.progress?.lastUpdated;
  if (!lastUpdated) {
    return { stale: false, ageHours: 0, lastUpdated: null };
  }

  const age = Date.now() - new Date(lastUpdated).getTime();
  const ageHours = Math.round(age / (1000 * 60 * 60));

  return {
    stale: ageHours > thresholdHours,
    ageHours,
    lastUpdated,
  };
}

module.exports = {
  CONFIG_FILENAME,
  CONTEXTBRIDGE_DIR,
  SECURITY_EXCLUSIONS,
  findConfigFile,
  loadConfig,
  applyDefaults,
  mergeExclusions,
  checkStaleness,
};
