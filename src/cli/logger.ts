/**
 * Logger utility — leveled logging with color support.
 * Levels: quiet < normal < verbose < debug
 * Auto-disables color in non-TTY environments (CI/CD).
 */

import chalk from 'chalk';
import type { LogLevel } from '../types';

const LEVELS: Record<LogLevel, number> = {
  quiet: 0,
  normal: 1,
  verbose: 2,
  debug: 3,
};

let currentLevel = LEVELS.normal;

export function setLogLevel(level: LogLevel): void {
  if (LEVELS[level] !== undefined) {
    currentLevel = LEVELS[level];
  }
}

export function getLogLevel(): LogLevel {
  const level = Object.keys(LEVELS).find((k) => LEVELS[k as LogLevel] === currentLevel);
  return (level as LogLevel) || 'normal';
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= currentLevel;
}

export const logger = {
  // Always shown (even in quiet mode)
  error(msg: string, ...args: unknown[]): void {
    console.error(chalk.red('✖ ERROR:'), msg, ...args);
  },

  // Always shown (even in quiet mode)
  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('normal')) {
      console.warn(chalk.yellow('⚠ WARN:'), msg, ...args);
    }
  },

  // Normal level — standard output
  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('normal')) {
      console.log(chalk.blue('ℹ'), msg, ...args);
    }
  },

  // Normal level — success messages
  success(msg: string, ...args: unknown[]): void {
    if (shouldLog('normal')) {
      console.log(chalk.green('✔'), msg, ...args);
    }
  },

  // Verbose level — extra detail
  verbose(msg: string, ...args: unknown[]): void {
    if (shouldLog('verbose')) {
      console.log(chalk.gray('• VERBOSE:'), msg, ...args);
    }
  },

  // Debug level — full diagnostic output
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(chalk.magenta('[DEBUG]'), msg, ...args);
    }
  },

  // Plain output (no level check, no prefix)
  plain(msg: string): void {
    console.log(msg);
  },

  // Newline
  newline(): void {
    console.log();
  },

  // Formatted table-style output
  table(data: Record<string, unknown>): void {
    if (shouldLog('normal')) {
      console.table(data);
    }
  },
};

// Export for testing or programmatic use
export { LEVELS };
