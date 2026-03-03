'use strict';

/**
 * File lock utility — simple advisory file locking for stats.json.
 * Uses lock files with PID to prevent concurrent corruption.
 * Includes stale lock detection (if process is dead, lock is stale).
 */

const fs = require('fs');
const path = require('path');

const LOCK_TIMEOUT_MS = 5000; // 5 seconds
const LOCK_RETRY_MS = 100;    // retry every 100ms
const STALE_LOCK_MS = 30000;  // locks older than 30s are considered stale

/**
 * Acquire a file lock. Returns a release function.
 * Throws if lock cannot be acquired within timeout.
 */
async function acquireLock(filePath) {
  const lockPath = filePath + '.lock';
  const lockContent = JSON.stringify({
    pid: process.pid,
    timestamp: Date.now(),
    hostname: require('os').hostname(),
  });

  const startTime = Date.now();

  while (true) {
    try {
      // Try to create lock file exclusively (O_EXCL — fails if exists)
      fs.writeFileSync(lockPath, lockContent, { flag: 'wx' });

      // Lock acquired — return release function
      return function release() {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Ignore — lock may have been cleaned up already
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw new Error(`Failed to acquire lock on ${filePath}: ${err.message}`);
      }

      // Lock file exists — check if it's stale
      try {
        const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const age = Date.now() - existing.timestamp;

        if (age > STALE_LOCK_MS) {
          // Stale lock — remove and retry
          fs.unlinkSync(lockPath);
          continue;
        }

        // Check if the PID is still alive (same machine)
        if (existing.hostname === require('os').hostname()) {
          try {
            process.kill(existing.pid, 0); // Signal 0 = check existence
          } catch {
            // Process is dead — stale lock
            fs.unlinkSync(lockPath);
            continue;
          }
        }
      } catch {
        // Can't read lock file — try to remove it
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        continue;
      }

      // Check timeout
      if (Date.now() - startTime >= LOCK_TIMEOUT_MS) {
        throw new Error(
          `Timeout acquiring lock on ${filePath}. ` +
          `Another process may be running. Delete ${lockPath} if this persists.`
        );
      }

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
}

/**
 * Read-modify-write a JSON file with locking.
 * `modifier` is called with the parsed content and should return the new content.
 */
async function lockedJsonUpdate(filePath, modifier) {
  const release = await acquireLock(filePath);
  try {
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      // File doesn't exist or is invalid — start fresh
    }

    const updated = modifier(data);

    // Atomic write: temp file + rename
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.tmp-${Date.now()}-${process.pid}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);

    return updated;
  } finally {
    release();
  }
}

module.exports = { acquireLock, lockedJsonUpdate };
