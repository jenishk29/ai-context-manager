'use strict';

/**
 * Git Collector — Gathers local git context for handoff files.
 *
 * Collects branch name, recent commits, uncommitted changes, and remote URL.
 * Gracefully degrades if git is unavailable or the project is not a git repo.
 * All data is local — no network calls.
 */

const { execSync } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

const GIT_TIMEOUT = 5000; // 5 second timeout for all git operations

/**
 * Execute a git command safely.
 * Returns the stdout string or null on failure.
 */
function git(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      timeout: GIT_TIMEOUT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if git is available on the system.
 */
function isGitAvailable() {
  try {
    execSync('git --version', {
      timeout: GIT_TIMEOUT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the given directory is inside a git repository.
 */
function isGitRepo(cwd) {
  const result = git('rev-parse --is-inside-work-tree', cwd);
  return result === 'true';
}

/**
 * Collect all git context for the project.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} options
 * @param {number} options.logCount - Number of recent commits (default: 5)
 * @returns {Object|null} Git context object, or null if unavailable
 */
function collectGitContext(projectRoot, options = {}) {
  const { logCount = 5 } = options;

  if (!isGitAvailable()) {
    logger.debug('Git is not available on this system.');
    return null;
  }

  if (!isGitRepo(projectRoot)) {
    logger.debug('Project is not a git repository.');
    return null;
  }

  const context = {
    available: true,
    branch: null,
    recentCommits: [],
    uncommittedChanges: [],
    uncommittedCount: 0,
    remoteUrl: null,
    hasUnpushed: false,
    unpushedCount: 0,
  };

  // Current branch
  context.branch = git('rev-parse --abbrev-ref HEAD', projectRoot) || 'unknown';

  // Recent commits (one-line format)
  const logOutput = git(
    `log --oneline --no-decorate -n ${logCount} --format="%h %s"`,
    projectRoot
  );
  if (logOutput) {
    context.recentCommits = logOutput.split('\n').filter(Boolean).map((line) => {
      const spaceIdx = line.indexOf(' ');
      return {
        hash: line.substring(0, spaceIdx),
        message: line.substring(spaceIdx + 1),
      };
    });
  }

  // Uncommitted changes (staged + unstaged)
  const statusOutput = git('status --porcelain', projectRoot);
  if (statusOutput) {
    context.uncommittedChanges = statusOutput.split('\n').filter(Boolean).map((line) => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      return { status, file };
    });
    context.uncommittedCount = context.uncommittedChanges.length;
  }

  // Remote URL (strip credentials if present)
  const remoteUrl = git('remote get-url origin', projectRoot);
  if (remoteUrl) {
    context.remoteUrl = sanitizeRemoteUrl(remoteUrl);
  }

  // Unpushed commits
  const unpushed = git('log @{u}..HEAD --oneline', projectRoot);
  if (unpushed) {
    const lines = unpushed.split('\n').filter(Boolean);
    context.hasUnpushed = lines.length > 0;
    context.unpushedCount = lines.length;
  }

  return context;
}

/**
 * Remove credentials from a git remote URL.
 * Converts: https://user:token@github.com/...  →  https://github.com/...
 */
function sanitizeRemoteUrl(url) {
  try {
    if (url.startsWith('http')) {
      const parsed = new URL(url);
      parsed.username = '';
      parsed.password = '';
      return parsed.toString().replace(/\/$/, '');
    }
    // SSH URLs are safe as-is
    return url;
  } catch {
    // If URL parsing fails, do basic regex sanitization
    return url.replace(/\/\/[^@]+@/, '//');
  }
}

/**
 * Format git context for display in the handoff.
 */
function formatGitContext(gitCtx) {
  if (!gitCtx || !gitCtx.available) return null;

  const lines = [];

  lines.push(`Branch: ${gitCtx.branch}`);

  if (gitCtx.recentCommits.length > 0) {
    lines.push('');
    lines.push('Recent commits:');
    for (const c of gitCtx.recentCommits) {
      lines.push(`  ${c.hash} ${c.message}`);
    }
  }

  if (gitCtx.uncommittedCount > 0) {
    lines.push('');
    lines.push(`Uncommitted changes: ${gitCtx.uncommittedCount} file(s)`);
    // Show up to 10 changed files
    const show = gitCtx.uncommittedChanges.slice(0, 10);
    for (const c of show) {
      lines.push(`  [${c.status}] ${c.file}`);
    }
    if (gitCtx.uncommittedChanges.length > 10) {
      lines.push(`  ... and ${gitCtx.uncommittedChanges.length - 10} more`);
    }
  }

  if (gitCtx.hasUnpushed) {
    lines.push('');
    lines.push(`Unpushed commits: ${gitCtx.unpushedCount}`);
  }

  return lines.join('\n');
}

module.exports = {
  isGitAvailable,
  isGitRepo,
  collectGitContext,
  formatGitContext,
  sanitizeRemoteUrl,
};
