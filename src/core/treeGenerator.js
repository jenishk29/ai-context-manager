'use strict';

/**
 * File Tree Generator — Builds a project file tree with depth/size limits.
 *
 * Uses fast-glob with .gitignore + security exclusions.
 * Annotates active files, truncates large trees, and normalizes paths.
 */

const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');
const { normalizePath } = require('../utils/platform');
const { logger } = require('../utils/logger');

/**
 * Build an ASCII file tree string for the project.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} options
 * @param {string[]} options.exclude - Glob patterns to exclude
 * @param {number} options.maxDepth - Maximum directory depth (default: 4)
 * @param {number} options.maxEntries - Maximum entries to include (default: 200)
 * @param {string[]} options.activeFiles - Files to annotate with ← ACTIVE
 * @returns {{ tree: string, totalFiles: number, truncated: boolean, truncatedCount: number }}
 */
function generateTree(projectRoot, options = {}) {
  const {
    exclude = [],
    maxDepth = 4,
    maxEntries = 200,
    activeFiles = [],
  } = options;

  // Normalize active files for comparison
  const normalizedActiveFiles = new Set(
    activeFiles.map((f) => normalizePath(f))
  );

  // Build glob ignore patterns
  const ignorePatterns = exclude.map((pattern) => {
    // Ensure patterns work with fast-glob
    if (pattern.endsWith('/')) return pattern + '**';
    return pattern;
  });

  let entries;
  try {
    entries = fg.sync(['**/*'], {
      cwd: projectRoot,
      ignore: ignorePatterns,
      dot: false,
      onlyFiles: false,
      markDirectories: true,
      deep: maxDepth,
      followSymbolicLinks: false,
      suppressErrors: true,
    });
  } catch (err) {
    logger.warn(`File tree generation failed: ${err.message}`);
    return { tree: '(unable to generate file tree)', totalFiles: 0, truncated: false, truncatedCount: 0 };
  }

  const totalFiles = entries.length;
  const truncated = totalFiles > maxEntries;
  const truncatedCount = truncated ? totalFiles - maxEntries : 0;

  // Truncate if needed
  const displayEntries = truncated ? entries.slice(0, maxEntries) : entries;

  // Build tree structure
  const tree = buildTreeString(displayEntries, normalizedActiveFiles);

  let result = tree;
  if (truncated) {
    result += `\n... and ${truncatedCount} more files/directories`;
  }

  return {
    tree: result,
    totalFiles,
    truncated,
    truncatedCount,
  };
}

/**
 * Build an ASCII tree string from flat path entries.
 */
function buildTreeString(entries, activeFiles) {
  if (entries.length === 0) return '(empty project)';

  // Sort entries for consistent output
  entries.sort();

  // Build a nested structure
  const root = {};
  for (const entry of entries) {
    const parts = entry.replace(/\/$/, '').split('/');
    let node = root;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
    // Mark if this is a directory
    if (entry.endsWith('/')) {
      node.__isDir = true;
    }
  }

  // Render the tree
  const lines = [];
  renderNode(root, '', '', lines, activeFiles);
  return lines.join('\n');
}

/**
 * Recursively render tree nodes into lines.
 */
function renderNode(node, prefix, currentPath, lines, activeFiles) {
  const keys = Object.keys(node).filter((k) => !k.startsWith('__')).sort((a, b) => {
    // Directories first
    const aIsDir = Object.keys(node[a]).filter((k) => !k.startsWith('__')).length > 0 || node[a].__isDir;
    const bIsDir = Object.keys(node[b]).filter((k) => !k.startsWith('__')).length > 0 || node[b].__isDir;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLast = i === keys.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const children = node[key];
    const childKeys = Object.keys(children).filter((k) => !k.startsWith('__'));
    const isDir = childKeys.length > 0 || children.__isDir;

    const entryPath = currentPath ? `${currentPath}/${key}` : key;
    const displayName = isDir ? key + '/' : key;

    // Check if this is an active file
    let annotation = '';
    if (activeFiles.has(entryPath)) {
      annotation = '  ← ACTIVE';
    }

    lines.push(`${prefix}${connector}${displayName}${annotation}`);

    if (childKeys.length > 0) {
      renderNode(children, prefix + childPrefix, entryPath, lines, activeFiles);
    }
  }
}

/**
 * Get a summary of the project — file count by extension.
 */
function getProjectSummary(projectRoot, exclude = []) {
  const ignorePatterns = exclude.map((p) => p.endsWith('/') ? p + '**' : p);

  try {
    const entries = fg.sync(['**/*'], {
      cwd: projectRoot,
      ignore: ignorePatterns,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    const exts = {};
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase() || '(no ext)';
      exts[ext] = (exts[ext] || 0) + 1;
    }

    // Sort by count descending
    const sorted = Object.entries(exts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // Top 15 extensions

    return {
      totalFiles: entries.length,
      byExtension: sorted,
    };
  } catch {
    return { totalFiles: 0, byExtension: [] };
  }
}

module.exports = { generateTree, getProjectSummary };
