'use strict';

/**
 * Logger utility — leveled logging with color support.
 * Levels: quiet < normal < verbose < debug
 * Auto-disables color in non-TTY environments (CI/CD).
 */

const chalk = require('chalk');

const LEVELS = {
  quiet: 0,
  normal: 1,
  verbose: 2,
  debug: 3,
};

let currentLevel = LEVELS.normal;

// Auto-detect: disable colors in non-TTY (CI/CD pipelines)
const isTTY = process.stdout.isTTY || false;

function setLogLevel(level) {
  if (LEVELS[level] !== undefined) {
    currentLevel = LEVELS[level];
  }
}

function getLogLevel() {
  return Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel);
}

function shouldLog(level) {
  return LEVELS[level] <= currentLevel;
}

const logger = {
  // Always shown (even in quiet mode)
  error(msg, ...args) {
    console.error(chalk.red('✖ ERROR:'), msg, ...args);
  },

  // Always shown (even in quiet mode)
  warn(msg, ...args) {
    if (shouldLog('normal')) {
      console.warn(chalk.yellow('⚠ WARN:'), msg, ...args);
    }
  },

  // Normal level — standard output
  info(msg, ...args) {
    if (shouldLog('normal')) {
      console.log(msg, ...args);
    }
  },

  // Success messages
  success(msg, ...args) {
    if (shouldLog('normal')) {
      console.log(chalk.green('✔'), msg, ...args);
    }
  },

  // Verbose level — extra detail
  verbose(msg, ...args) {
    if (shouldLog('verbose')) {
      console.log(chalk.dim('[verbose]'), msg, ...args);
    }
  },

  // Debug level — internal detail
  debug(msg, ...args) {
    if (shouldLog('debug')) {
      console.log(chalk.gray('[debug]'), msg, ...args);
    }
  },

  // Blank line
  blank() {
    if (shouldLog('normal')) {
      console.log('');
    }
  },

  // Indented info (for structured output)
  indent(msg, ...args) {
    if (shouldLog('normal')) {
      console.log('  ', msg, ...args);
    }
  },

  // Section header
  section(title) {
    if (shouldLog('normal')) {
      console.log('');
      console.log(chalk.bold.underline(title));
    }
  },

  // Key-value pair display
  kv(key, value) {
    if (shouldLog('normal')) {
      console.log(`   ${chalk.dim(key + ':')} ${value}`);
    }
  },
};

module.exports = { logger, setLogLevel, getLogLevel, LEVELS };
