'use strict';

/**
 * Path Resolver — Validates and resolves file paths securely.
 *
 * Prevents path traversal attacks by ensuring all resolved paths
 * remain within the project root. Handles symlinks safely.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Resolve a relative path against the project root and validate it.
 * Returns { valid: boolean, resolved: string|null, error: string|null }
 */
function resolveAndValidate(projectRoot, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return { valid: false, resolved: null, error: 'Path is empty or invalid.' };
  }

  // Reject absolute paths outright
  if (path.isAbsolute(relativePath)) {
    return {
      valid: false,
      resolved: null,
      error: `Absolute paths are not allowed: ${relativePath}. Use paths relative to the project root.`,
    };
  }

  // Reject obvious traversal attempts
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..') || normalized.startsWith(path.sep + '..')) {
    return {
      valid: false,
      resolved: null,
      error: `Path traversal detected: ${relativePath}. Paths must stay within the project root.`,
    };
  }

  // Resolve against project root
  const resolved = path.resolve(projectRoot, relativePath);
  const projectRootResolved = path.resolve(projectRoot);

  // Ensure the resolved path starts with the project root
  if (!resolved.startsWith(projectRootResolved + path.sep) && resolved !== projectRootResolved) {
    return {
      valid: false,
      resolved: null,
      error: `Path escapes project root: ${relativePath} resolves to ${resolved}`,
    };
  }

  // If the file exists, also check the real path (resolving symlinks)
  if (fs.existsSync(resolved)) {
    try {
      const realPath = fs.realpathSync(resolved);
      const realProjectRoot = fs.realpathSync(projectRootResolved);

      if (!realPath.startsWith(realProjectRoot + path.sep) && realPath !== realProjectRoot) {
        return {
          valid: false,
          resolved: null,
          error: `Symlink escapes project root: ${relativePath} -> ${realPath}`,
        };
      }
    } catch (err) {
      return {
        valid: false,
        resolved: null,
        error: `Cannot resolve symlink for ${relativePath}: ${err.message}`,
      };
    }
  }

  return { valid: true, resolved, error: null };
}

/**
 * Validate an array of file paths. Returns validated paths and errors.
 */
function validatePaths(projectRoot, relativePaths) {
  const valid = [];
  const errors = [];

  for (const p of relativePaths) {
    const result = resolveAndValidate(projectRoot, p);
    if (result.valid) {
      valid.push({ relative: p, absolute: result.resolved });
    } else {
      errors.push(result.error);
    }
  }

  return { valid, errors };
}

/**
 * Check if a file exists and is readable within the project.
 */
function fileExistsInProject(projectRoot, relativePath) {
  const result = resolveAndValidate(projectRoot, relativePath);
  if (!result.valid) return false;

  try {
    fs.accessSync(result.resolved, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a symlink.
 */
function isSymlink(filePath) {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

module.exports = {
  resolveAndValidate,
  validatePaths,
  fileExistsInProject,
  isSymlink,
};
