'use strict';

/**
 * Platform utilities — cross-platform path normalization,
 * encoding handling, and OS-specific helpers.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Normalize a file path to use forward slashes (for display/output).
 * Internal operations still use path.sep, but all output uses '/'.
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Resolve and normalize a path relative to a base directory.
 * Returns the resolved absolute path with forward slashes.
 */
function resolvePath(basePath, relativePath) {
  return normalizePath(path.resolve(basePath, relativePath));
}

/**
 * Read a file as UTF-8, stripping BOM if present.
 */
function readFileUTF8(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip UTF-8 BOM (0xEF 0xBB 0xBF)
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return content;
}

/**
 * Write a file atomically — write to temp file, then rename.
 * Prevents corruption on crash or disk-full.
 */
function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.tmp-${Date.now()}-${process.pid}`);

  try {
    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });

    // Write to temp file
    fs.writeFileSync(tmpPath, content, 'utf8');

    // Atomic rename
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Check if a file is likely binary by reading the first 8KB.
 * Looks for null bytes which indicate binary content.
 */
function isBinaryFile(filePath) {
  const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.pyc', '.pyo', '.class', '.o', '.obj',
    '.sqlite', '.db', '.lock',
  ]);

  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true; // Null byte found → binary
    }
    return false;
  } catch {
    return false; // If we can't read it, assume text
  }
}

/**
 * Get platform info for diagnostics.
 */
function getPlatformInfo() {
  return {
    os: os.platform(),
    arch: os.arch(),
    nodeVersion: process.versions.node,
    cwd: process.cwd(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
  };
}

/**
 * Check if a directory is writable.
 */
function isDirectoryWritable(dirPath) {
  try {
    const testFile = path.join(dirPath, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available disk space (approximate, works on most platforms).
 * Returns bytes available, or -1 if unknown.
 */
function getAvailableDiskSpace(dirPath) {
  // Node.js 18+ has fs.statfs
  if (typeof fs.statfsSync === 'function') {
    try {
      const stats = fs.statfsSync(dirPath);
      return stats.bavail * stats.bsize;
    } catch {
      return -1;
    }
  }
  return -1;
}

module.exports = {
  normalizePath,
  resolvePath,
  readFileUTF8,
  writeFileAtomic,
  isBinaryFile,
  getPlatformInfo,
  isDirectoryWritable,
  getAvailableDiskSpace,
};
