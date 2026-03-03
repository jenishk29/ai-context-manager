'use strict';

/**
 * Handoff Renderer — Generates Markdown and JSON handoff files.
 *
 * Uses EJS template for Markdown generation.
 * Respects maxTokens budget with priority-based truncation.
 * Runs secret scanner on final output before writing.
 */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { analyzeTokens, checkSizeBudget } = require('./tokenEstimator');
const { scanForSecrets, formatScanResults } = require('./secretScanner');
const { writeFileAtomic, normalizePath } = require('../utils/platform');
const { logger } = require('../utils/logger');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'handoff.md.ejs');

/**
 * Render the handoff files (Markdown and/or JSON).
 *
 * @param {Object} data - All collected project data
 * @param {Object} data.config - Loaded config
 * @param {string} data.projectRoot - Project root path
 * @param {string} data.fileTree - Generated file tree string
 * @param {Object|null} data.gitContext - Git context (formatted string)
 * @param {Object} data.stackInfo - Stack detection results
 * @param {Object} options
 * @param {string} options.format - 'md' | 'json' | 'both'
 * @param {number} options.maxTokens - Token budget
 * @param {boolean} options.force - Skip secret scan warnings
 * @param {boolean} options.dryRun - Preview only, don't write
 * @returns {Object} { markdown, json, tokenAnalysis, secretScan, files }
 */
function renderHandoff(data, options = {}) {
  const {
    format = 'both',
    maxTokens = 8000,
    force = false,
    dryRun = false,
  } = options;

  const config = data.config;
  const version = require('../../package.json').version;

  // Build template data
  const templateData = {
    schemaVersion: config.schemaVersion,
    version,
    timestamp: new Date().toISOString().split('T')[0] + ' ' +
      new Date().toTimeString().split(' ')[0],
    project: {
      name: config.project.name,
      stack: config.project.stack,
      description: config.project.description,
    },
    progress: config.progress,
    activeTask: config.activeTask,
    architecture: config.architecture,
    fileTree: data.fileTree || null,
    gitContext: data.gitContext || null,
    tokenInfo: null, // Will be filled after initial render
    jsonBlock: '', // Placeholder
  };

  // Build JSON payload
  const jsonPayload = buildJsonPayload(templateData, data);

  // Set the JSON block for the markdown template
  templateData.jsonBlock = JSON.stringify(jsonPayload, null, 2);

  // Render markdown
  let markdown = renderMarkdown(templateData);

  // Analyze tokens
  let tokenAnalysis = analyzeTokens(markdown);

  // Check budget and truncate if needed
  const budget = checkSizeBudget(tokenAnalysis.total, maxTokens);
  if (!budget.withinBudget) {
    logger.verbose(`Handoff exceeds token budget (${tokenAnalysis.total} > ${maxTokens}). Truncating...`);
    const truncated = truncateHandoff(templateData, data, maxTokens);
    markdown = truncated.markdown;
    tokenAnalysis = truncated.tokenAnalysis;
    templateData.jsonBlock = truncated.jsonBlock;
  }

  // Fill in token info and re-render
  templateData.tokenInfo = { total: tokenAnalysis.total };
  templateData.jsonBlock = JSON.stringify(
    { ...jsonPayload, meta: { ...jsonPayload.meta, tokens: tokenAnalysis.total } },
    null, 2
  );
  markdown = renderMarkdown(templateData);
  tokenAnalysis = analyzeTokens(markdown);

  // Secret scan
  const secretScan = scanForSecrets(markdown);

  // Determine output files
  const outputDir = path.join(data.projectRoot, '.ai-context-manager');
  const files = [];

  if (format === 'md' || format === 'both') {
    files.push({
      path: path.join(outputDir, 'snapshot.hoff.md'),
      content: markdown,
      type: 'markdown',
    });
  }

  if (format === 'json' || format === 'both') {
    const jsonContent = JSON.stringify(jsonPayload, null, 2);
    files.push({
      path: path.join(outputDir, 'snapshot.hoff.json'),
      content: jsonContent,
      type: 'json',
    });
  }

  return {
    markdown,
    json: jsonPayload,
    tokenAnalysis,
    secretScan,
    files,
    dryRun,
  };
}

/**
 * Render the Markdown template.
 */
function renderMarkdown(templateData) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return ejs.render(template, templateData, {
    filename: TEMPLATE_PATH, // For include resolution
  });
}

/**
 * Build the machine-readable JSON payload.
 */
function buildJsonPayload(templateData, data) {
  return {
    schema: '1.0',
    resume: true,
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'ai-context-manager',
      generatorVersion: require('../../package.json').version,
      tokens: 0, // Will be updated
    },
    project: {
      name: templateData.project.name,
      stack: templateData.project.stack.map((s) => typeof s === 'string' ? s : s.name),
      description: templateData.project.description,
    },
    progress: templateData.progress,
    activeTask: templateData.activeTask,
    architecture: templateData.architecture,
    git: data.gitContextRaw || null,
  };
}

/**
 * Truncate the handoff to fit within token budget.
 * Priority order (truncate first → last):
 *   1. File tree (least critical)
 *   2. Git history (nice to have)
 *   3. Architecture details
 *   4. Progress notes (important but can be summarized)
 *   5. Resume prompt + active task (NEVER truncated)
 */
function truncateHandoff(templateData, data, maxTokens) {
  const stages = [
    // Stage 1: Remove file tree
    () => { templateData.fileTree = null; },
    // Stage 2: Remove git context
    () => { templateData.gitContext = null; },
    // Stage 3: Truncate architecture
    () => {
      templateData.architecture = {
        overview: templateData.architecture.overview
          ? templateData.architecture.overview.substring(0, 200) + '...'
          : '',
        patterns: templateData.architecture.patterns.slice(0, 3),
        constraints: templateData.architecture.constraints, // Keep constraints
      };
    },
    // Stage 4: Truncate progress
    () => {
      templateData.progress = {
        ...templateData.progress,
        completed: templateData.progress.completed.slice(-5), // Last 5 only
        nextSteps: templateData.progress.nextSteps.slice(0, 5), // First 5 only
      };
    },
  ];

  for (const stage of stages) {
    stage();
    const jsonPayload = buildJsonPayload(templateData, data);
    templateData.jsonBlock = JSON.stringify(jsonPayload, null, 2);
    const markdown = renderMarkdown(templateData);
    const analysis = analyzeTokens(markdown);

    if (analysis.total <= maxTokens) {
      return { markdown, tokenAnalysis: analysis, jsonBlock: templateData.jsonBlock };
    }
  }

  // If still over budget after all truncation, render as-is with warning
  const jsonPayload = buildJsonPayload(templateData, data);
  templateData.jsonBlock = JSON.stringify(jsonPayload, null, 2);
  const markdown = renderMarkdown(templateData);
  const analysis = analyzeTokens(markdown);
  logger.warn(`Handoff is ${analysis.total} tokens — exceeds budget of ${maxTokens} even after truncation.`);

  return { markdown, tokenAnalysis: analysis, jsonBlock: templateData.jsonBlock };
}

/**
 * Write the rendered files to disk.
 */
function writeHandoffFiles(result) {
  const written = [];
  for (const file of result.files) {
    writeFileAtomic(file.path, file.content);
    written.push(file.path);
  }
  return written;
}

module.exports = { renderHandoff, writeHandoffFiles };
