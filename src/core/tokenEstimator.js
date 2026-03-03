'use strict';

/**
 * Token Estimator — Honest, transparent token estimation.
 *
 * Estimates tokens based on content type (prose vs code vs config).
 * Shows concrete numbers only — no fabricated "savings" multipliers.
 * Provides context window percentages for major AI models.
 */

const { logger } = require('../utils/logger');

/**
 * Known context window sizes (as of 2025-2026).
 * Used for percentage calculations, not for any claims about savings.
 */
const CONTEXT_WINDOWS = {
  'GPT-4o': 128000,
  'GPT-4o-mini': 128000,
  'GPT-4': 8192,
  'GPT-3.5': 16385,
  'Claude 3.5 Sonnet': 200000,
  'Claude 3 Opus': 200000,
  'Gemini 1.5 Pro': 1000000,
  'Gemini 1.5 Flash': 1000000,
  'Copilot Chat': 8000,  // Approximate effective limit
};

/**
 * Character-per-token ratios by content type.
 * Based on empirical observations across multiple tokenizers.
 * These are approximations — exact counts vary by model.
 */
const CHARS_PER_TOKEN = {
  prose: 4.0,      // English prose (markdown, comments)
  code: 2.8,       // Code (symbols, brackets, indentation)
  json: 2.5,       // JSON/YAML/config (keys, braces, quotes)
  mixed: 3.2,      // Mixed content (typical handoff)
};

/**
 * Estimate token count from text content.
 *
 * @param {string} content - Text to estimate
 * @param {string} contentType - 'prose' | 'code' | 'json' | 'mixed'
 * @returns {number} Estimated token count
 */
function estimateTokens(content, contentType = 'mixed') {
  if (!content) return 0;
  const ratio = CHARS_PER_TOKEN[contentType] || CHARS_PER_TOKEN.mixed;
  return Math.round(content.length / ratio);
}

/**
 * Analyze content and estimate tokens with breakdown.
 * Categorizes content by type for more accurate estimation.
 *
 * @param {string} content - Full handoff content
 * @returns {Object} Token analysis
 */
function analyzeTokens(content) {
  if (!content) {
    return {
      total: 0,
      breakdown: {},
      contextPercentages: {},
      charCount: 0,
      lineCount: 0,
    };
  }

  const lines = content.split('\n');
  let proseChars = 0;
  let codeChars = 0;
  let jsonChars = 0;
  let inCodeBlock = false;
  let inJsonBlock = false;

  for (const line of lines) {
    const lineLength = line.length + 1; // +1 for newline

    if (line.startsWith('```json')) {
      inJsonBlock = true;
      codeChars += lineLength;
      continue;
    }
    if (line.startsWith('```') && (inCodeBlock || inJsonBlock)) {
      inCodeBlock = false;
      inJsonBlock = false;
      codeChars += lineLength;
      continue;
    }
    if (line.startsWith('```')) {
      inCodeBlock = true;
      codeChars += lineLength;
      continue;
    }

    if (inJsonBlock) {
      jsonChars += lineLength;
    } else if (inCodeBlock) {
      codeChars += lineLength;
    } else {
      proseChars += lineLength;
    }
  }

  const proseTokens = Math.round(proseChars / CHARS_PER_TOKEN.prose);
  const codeTokens = Math.round(codeChars / CHARS_PER_TOKEN.code);
  const jsonTokens = Math.round(jsonChars / CHARS_PER_TOKEN.json);
  const total = proseTokens + codeTokens + jsonTokens;

  // Context window percentages
  const contextPercentages = {};
  for (const [model, window] of Object.entries(CONTEXT_WINDOWS)) {
    contextPercentages[model] = {
      percentage: Math.round((total / window) * 10000) / 100,
      remaining: window - total,
      window,
    };
  }

  return {
    total,
    breakdown: {
      prose: proseTokens,
      code: codeTokens,
      json: jsonTokens,
    },
    contextPercentages,
    charCount: content.length,
    lineCount: lines.length,
  };
}

/**
 * Format token analysis for console output.
 */
function formatTokenAnalysis(analysis) {
  const lines = [];

  lines.push(`Context size: ~${analysis.total.toLocaleString()} tokens (${analysis.charCount.toLocaleString()} chars, ${analysis.lineCount} lines)`);

  if (analysis.breakdown.prose || analysis.breakdown.code || analysis.breakdown.json) {
    const parts = [];
    if (analysis.breakdown.prose) parts.push(`prose: ~${analysis.breakdown.prose}`);
    if (analysis.breakdown.code) parts.push(`code: ~${analysis.breakdown.code}`);
    if (analysis.breakdown.json) parts.push(`json: ~${analysis.breakdown.json}`);
    lines.push(`   Breakdown: ${parts.join(', ')}`);
  }

  lines.push('');
  lines.push('   Context window usage:');

  // Show top models
  const displayModels = ['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'Copilot Chat', 'GPT-3.5'];
  for (const model of displayModels) {
    const pct = analysis.contextPercentages[model];
    if (pct) {
      const bar = makeBar(pct.percentage);
      lines.push(`   ${model.padEnd(20)} ${bar} ${pct.percentage}%`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a simple progress bar.
 */
function makeBar(percentage) {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(empty, 0)) + ']';
}

/**
 * Check if the handoff exceeds a recommended size for a specific model.
 */
function checkSizeBudget(totalTokens, maxTokens = 8000) {
  return {
    withinBudget: totalTokens <= maxTokens,
    tokens: totalTokens,
    budget: maxTokens,
    overBy: Math.max(0, totalTokens - maxTokens),
    percentage: Math.round((totalTokens / maxTokens) * 100),
  };
}

module.exports = {
  estimateTokens,
  analyzeTokens,
  formatTokenAnalysis,
  checkSizeBudget,
  CONTEXT_WINDOWS,
  CHARS_PER_TOKEN,
};
