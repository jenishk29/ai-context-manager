'use strict';

/**
 * `ai-context-manager validate` — Validate the config file.
 *
 * Runs JSON Schema validation and reports all errors with detail.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { loadConfig, CONFIG_FILENAME } = require('../core/configLoader');
const { validatePaths } = require('../core/pathResolver');
const { logger } = require('../utils/logger');

module.exports = {
  command: 'validate',
  describe: 'Validate the .ai-context-manager.json config file',
  builder: (yargs) => yargs,
  handler: (argv) => {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, CONFIG_FILENAME);

    if (!fs.existsSync(configPath)) {
      logger.error(`${CONFIG_FILENAME} not found.`);
      logger.info(`Run ${chalk.cyan('acm init')} to create one.`);
      process.exit(2);
    }

    logger.info(`Validating ${chalk.cyan(CONFIG_FILENAME)}...`);
    logger.blank();

    const { config, errors } = loadConfig(projectRoot, argv.config);

    if (errors.length > 0) {
      logger.error('Validation failed:');
      logger.blank();
      for (const err of errors) {
        logger.info(`  ${chalk.red('✖')} ${err}`);
      }
      process.exit(2);
    }

    // Additional semantic checks
    const warnings = [];

    // Check empty progress
    const progress = config.progress;
    const hasProgress = progress.completed.length > 0 ||
      progress.inProgress.length > 0 ||
      progress.nextSteps.length > 0;
    if (!hasProgress) {
      warnings.push('All progress fields are empty. The handoff will lack project state context.');
    }

    // Check empty active task
    if (!config.activeTask.description) {
      warnings.push('Active task description is empty. Consider adding what you\'re working on.');
    }

    // Check relevantFiles
    if (config.activeTask.relevantFiles.length > 0) {
      const { errors: pathErrors } = validatePaths(
        projectRoot,
        config.activeTask.relevantFiles
      );
      for (const err of pathErrors) {
        warnings.push(err);
      }
    }

    // Check project name
    if (config.project.name === 'unnamed-project' || !config.project.name) {
      warnings.push('Project name is unset. Consider adding a meaningful name.');
    }

    // Display results
    logger.success('Config is valid JSON and passes schema validation.');

    if (warnings.length > 0) {
      logger.blank();
      logger.info(chalk.yellow(`${warnings.length} suggestion(s):`));
      for (const w of warnings) {
        logger.info(`  ${chalk.yellow('⚠')} ${w}`);
      }
    }

    // Show config summary
    logger.blank();
    logger.info(chalk.bold('Config summary:'));
    logger.kv('Project', config.project.name);
    logger.kv('Stack', config.project.stack.length > 0 ? config.project.stack.join(', ') : '(none detected)');
    logger.kv('Completed items', progress.completed.length.toString());
    logger.kv('In-progress items', progress.inProgress.length.toString());
    logger.kv('Next steps', progress.nextSteps.length.toString());
    logger.kv('Blockers', progress.blockers.length.toString());
    logger.kv('Relevant files', config.activeTask.relevantFiles.length.toString());
    logger.kv('Max tokens', config.options.maxTokens.toString());
    logger.kv('Output format', config.options.format);

    logger.blank();
  },
};
