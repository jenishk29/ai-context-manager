'use strict';

/**
 * Secret Scanner — Detects accidental secrets in handoff content.
 *
 * Runs on the final handoff output BEFORE writing to disk.
 * Prevents leaking API keys, passwords, tokens, and private keys
 * into files that are designed to be pasted into third-party AI tools.
 */

const { logger } = require('../utils/logger');

/**
 * Patterns for common secrets. Each has:
 * - name: human-readable description
 * - pattern: regex to match
 * - severity: 'critical' | 'warning'
 */
const SECRET_PATTERNS = [
  // AWS
  {
    name: 'AWS Access Key ID',
    pattern: /(?:^|[^A-Z0-9])AKIA[0-9A-Z]{16}(?:[^A-Z0-9]|$)/,
    severity: 'critical',
  },
  {
    name: 'AWS Secret Access Key',
    pattern: /(?:aws_secret_access_key|aws_secret_key)\s*[=:]\s*[A-Za-z0-9/+=]{40}/i,
    severity: 'critical',
  },

  // Private keys
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/,
    severity: 'critical',
  },

  // Generic API keys
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/i,
    severity: 'warning',
  },

  // JWT Tokens
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    severity: 'warning',
  },

  // GitHub tokens
  {
    name: 'GitHub Token',
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/,
    severity: 'critical',
  },

  // Slack tokens
  {
    name: 'Slack Token',
    pattern: /xox[bpors]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}/,
    severity: 'critical',
  },

  // Generic passwords in config
  {
    name: 'Password in config',
    pattern: /(?:password|passwd|pwd|secret)\s*[=:]\s*['"][^'"]{8,}['"]/i,
    severity: 'warning',
  },

  // Database connection strings
  {
    name: 'Database Connection String',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@]+@/i,
    severity: 'critical',
  },

  // Bearer tokens
  {
    name: 'Bearer Token',
    pattern: /[Bb]earer\s+[A-Za-z0-9_\-.]{20,}/,
    severity: 'warning',
  },

  // OpenAI API keys
  {
    name: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9]{20,}/,
    severity: 'critical',
  },

  // Stripe keys
  {
    name: 'Stripe API Key',
    pattern: /(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{20,}/,
    severity: 'critical',
  },

  // SendGrid
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
    severity: 'critical',
  },

  // Google API Key
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/,
    severity: 'critical',
  },

  // High-entropy strings (potential secrets) — only for specific key-value patterns
  {
    name: 'High-entropy secret value',
    pattern: /(?:secret|token|key|auth|credential)\s*[=:]\s*['"][A-Za-z0-9+/=_-]{32,}['"]/i,
    severity: 'warning',
  },
];

/**
 * Scan content for secrets.
 * @param {string} content - The full handoff content to scan
 * @returns {{ found: boolean, matches: Array<{name: string, severity: string, line: number, snippet: string}> }}
 */
function scanForSecrets(content) {
  const matches = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.pattern.test(line)) {
        // Redact the actual value in the snippet
        const snippet = line.length > 80
          ? line.substring(0, 77) + '...'
          : line;

        matches.push({
          name: pattern.name,
          severity: pattern.severity,
          line: i + 1,
          snippet: snippet.trim(),
        });
      }
    }
  }

  // Deduplicate by line + name
  const seen = new Set();
  const unique = matches.filter((m) => {
    const key = `${m.line}:${m.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    found: unique.length > 0,
    matches: unique,
    critical: unique.filter((m) => m.severity === 'critical'),
    warnings: unique.filter((m) => m.severity === 'warning'),
  };
}

/**
 * Format scan results for console output.
 */
function formatScanResults(results) {
  const lines = [];

  if (results.critical.length > 0) {
    lines.push('CRITICAL — Potential secrets detected:');
    for (const m of results.critical) {
      lines.push(`  Line ${m.line}: ${m.name}`);
      lines.push(`    ${m.snippet}`);
    }
  }

  if (results.warnings.length > 0) {
    lines.push('WARNING — Possible sensitive data:');
    for (const m of results.warnings) {
      lines.push(`  Line ${m.line}: ${m.name}`);
      lines.push(`    ${m.snippet}`);
    }
  }

  return lines.join('\n');
}

module.exports = { scanForSecrets, formatScanResults, SECRET_PATTERNS };
