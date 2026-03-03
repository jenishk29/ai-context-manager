'use strict';

/**
 * `ai-context-manager doctor` — Self-diagnostic command.
 *
 * Checks Node.js version, config validity, file permissions,
 * git availability, disk space, and security.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { loadConfig, CONFIG_FILENAME, CONTEXTBRIDGE_DIR } = require('../core/configLoader');
const { isGitAvailable, isGitRepo } = require('../core/gitCollector');
const { validatePaths } = require('../core/pathResolver');
const { getPlatformInfo, isDirectoryWritable, getAvailableDiskSpace } = require('../utils/platform');
const { logger } = require('../utils/logger');

module.exports = {
  command: 'doctor',
  describe: 'Run diagnostics to check AI Context Manager setup',
  builder: (yargs) => yargs,
  handler: (argv) => {
    const projectRoot = process.cwd();
    const checks = [];
    let hasError = false;

    logger.section('AI Context Manager Doctor');
    logger.blank();

    // 1. Node.js version
    const [major] = process.versions.node.split('.').map(Number);
    if (major >= 18) {
      addCheck(checks, 'pass', `Node.js version: ${process.versions.node}`);
    } else {
      addCheck(checks, 'fail', `Node.js version: ${process.versions.node} (requires >= 18.0.0)`);
      hasError = true;
    }

    // 2. Platform info
    const platform = getPlatformInfo();
    addCheck(checks, 'info', `Platform: ${platform.os} ${platform.arch}`);

    // 3. Config file exists
    const configPath = path.join(projectRoot, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      addCheck(checks, 'pass', `Config file found: ${CONFIG_FILENAME}`);

      // 4. Config is valid
      const { config, errors } = loadConfig(projectRoot, argv.config);
      if (errors.length === 0) {
        addCheck(checks, 'pass', 'Config file is valid JSON and passes schema validation');
      } else {
        for (const err of errors) {
          addCheck(checks, 'fail', `Config error: ${err}`);
          hasError = true;
        }
      }

      // 5. Validate relevantFiles
      if (config && config.activeTask.relevantFiles.length > 0) {
        const { valid, errors: pathErrors } = validatePaths(
          projectRoot,
          config.activeTask.relevantFiles
        );
        if (pathErrors.length === 0) {
          addCheck(checks, 'pass', `All ${valid.length} relevant files exist and are valid`);
        } else {
          for (const err of pathErrors) {
            addCheck(checks, 'warn', `Relevant file issue: ${err}`);
          }
        }
      }
    } else {
      addCheck(checks, 'warn', `Config file not found. Run 'acm init' first.`);
    }

    // 6. .ai-context-manager/ directory
    const contextDir = path.join(projectRoot, CONTEXTBRIDGE_DIR);
    if (fs.existsSync(contextDir)) {
      addCheck(checks, 'pass', `${CONTEXTBRIDGE_DIR}/ directory exists`);

      // 7. Directory is writable
      if (isDirectoryWritable(contextDir)) {
        addCheck(checks, 'pass', `${CONTEXTBRIDGE_DIR}/ is writable`);
      } else {
        addCheck(checks, 'fail', `${CONTEXTBRIDGE_DIR}/ is not writable`);
        hasError = true;
      }
    } else {
      addCheck(checks, 'info', `${CONTEXTBRIDGE_DIR}/ directory not yet created (will be created on first snapshot)`);
    }

    // 8. Disk space
    const diskSpace = getAvailableDiskSpace(projectRoot);
    if (diskSpace > 0) {
      const mb = Math.round(diskSpace / (1024 * 1024));
      if (mb > 10) {
        addCheck(checks, 'pass', `Disk space: ${mb.toLocaleString()} MB available`);
      } else {
        addCheck(checks, 'warn', `Low disk space: only ${mb} MB available`);
      }
    }

    // 9. Git availability
    if (isGitAvailable()) {
      addCheck(checks, 'pass', 'Git is available');
      if (isGitRepo(projectRoot)) {
        addCheck(checks, 'pass', 'Project is a git repository');
      } else {
        addCheck(checks, 'info', 'Project is not a git repository (git context will be skipped)');
      }
    } else {
      addCheck(checks, 'info', 'Git not found (git context will be skipped)');
    }

    // 10. .gitignore check
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes('.ai-context-manager/') || content.includes('.ai-context-manager')) {
        addCheck(checks, 'pass', '.ai-context-manager/ is in .gitignore');
      } else {
        addCheck(checks, 'warn', '.ai-context-manager/ is NOT in .gitignore — handoff files may be committed');
      }
    }

    // Display results
    logger.blank();
    const passed = checks.filter((c) => c.status === 'pass').length;
    const failed = checks.filter((c) => c.status === 'fail').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;

    for (const check of checks) {
      const icon = {
        pass: chalk.green('✔'),
        fail: chalk.red('✖'),
        warn: chalk.yellow('⚠'),
        info: chalk.blue('ℹ'),
      }[check.status];
      logger.info(`  ${icon} ${check.message}`);
    }

    logger.blank();
    logger.info(
      `${chalk.green(passed + ' passed')}, ` +
      `${chalk.red(failed + ' failed')}, ` +
      `${chalk.yellow(warnings + ' warnings')}`
    );

    if (hasError) {
      process.exit(1);
    }
  },
};

function addCheck(checks, status, message) {
  checks.push({ status, message });
}
