'use strict';

/**
 * `contextbridge init` — Initialize ContextBridge in a project.
 *
 * Auto-detects stack and project name, creates .contextbridge.json config,
 * creates .contextbridge/ directory, and adds to .gitignore.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { detectStack } = require('../core/stackDetector');
const { CONFIG_FILENAME, CONTEXTBRIDGE_DIR } = require('../core/configLoader');
const { writeFileAtomic, normalizePath } = require('../utils/platform');
const { logger } = require('../utils/logger');

module.exports = {
  command: 'init',
  describe: 'Initialize ContextBridge in the current project',
  builder: (yargs) => {
    return yargs
      .option('yes', {
        alias: 'y',
        type: 'boolean',
        description: 'Accept all defaults (non-interactive mode)',
        default: false,
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Overwrite existing config file',
        default: false,
      });
  },
  handler: async (argv) => {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, CONFIG_FILENAME);
    const contextDir = path.join(projectRoot, CONTEXTBRIDGE_DIR);

    // Check if config already exists
    if (fs.existsSync(configPath) && !argv.force) {
      logger.warn(`${CONFIG_FILENAME} already exists.`);
      logger.info(`Use ${chalk.cyan('--force')} to overwrite, or edit the existing config.`);
      process.exit(0);
    }

    logger.info(chalk.bold('Initializing AI Context Manager...'));
    logger.blank();

    // Auto-detect stack
    logger.info('Detecting project stack...');
    const { stack, projectName } = detectStack(projectRoot);

    if (stack.length > 0) {
      logger.success(`Detected: ${stack.map((s) => chalk.cyan(s.name)).join(', ')}`);
    } else {
      logger.info('No specific stack detected. You can add it manually in the config.');
    }

    logger.info(`Project name: ${chalk.cyan(projectName)}`);
    logger.blank();

    // In non-interactive mode or if stdin is not TTY, use defaults
    let finalName = projectName;
    let finalStack = stack.map((s) => s.name);

    if (!argv.yes && process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (q) => new Promise((resolve) => rl.question(q, resolve));

      try {
        const nameAnswer = await question(`Project name [${projectName}]: `);
        if (nameAnswer.trim()) finalName = nameAnswer.trim();

        const stackAnswer = await question(`Stack [${finalStack.join(', ')}]: `);
        if (stackAnswer.trim()) {
          finalStack = stackAnswer.split(',').map((s) => s.trim()).filter(Boolean);
        }
      } finally {
        rl.close();
      }
    }

    // Generate config
    const config = {
      $schema: 'https://contextbridge.dev/schema/config-v1.json',
      schemaVersion: '1.0',
      project: {
        name: finalName,
        stack: finalStack,
        description: '',
      },
      progress: {
        completed: [],
        inProgress: [],
        nextSteps: [],
        blockers: [],
        lastUpdated: new Date().toISOString(),
      },
      activeTask: {
        description: '',
        relevantFiles: [],
      },
      architecture: {
        overview: '',
        patterns: [],
        constraints: [],
      },
      exclude: [],
      options: {
        maxTokens: 8000,
        format: 'both',
        treeDepth: 4,
        maxTreeEntries: 200,
        includeGit: true,
        gitLogCount: 5,
      },
    };

    // Write config file
    writeFileAtomic(configPath, JSON.stringify(config, null, 2) + '\n');
    logger.success(`Created ${chalk.green(CONFIG_FILENAME)}`);

    // Create .contextbridge directory
    fs.mkdirSync(contextDir, { recursive: true });
    logger.success(`Created ${chalk.green(CONTEXTBRIDGE_DIR + '/')} directory`);

    // Add .contextbridge/ to .gitignore
    addToGitignore(projectRoot);

    // Summary
    logger.blank();
    logger.info(chalk.bold('Setup complete!'));
    logger.blank();
    logger.info('Next steps:');
    logger.indent(`1. Edit ${chalk.cyan(CONFIG_FILENAME)} to add your progress & context`);
    logger.indent(`2. Run ${chalk.cyan('acm snapshot')} to generate a handoff file`);
    logger.indent(`3. Paste the handoff into your new AI session`);
    logger.blank();
    logger.info(chalk.dim('The config file has inline documentation. Fill in the sections'));
    logger.info(chalk.dim('that match your current project state.'));
  },
};

/**
 * Add .contextbridge/ to .gitignore if it exists and doesn't already have it.
 */
function addToGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const entry = '.contextbridge/';

  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes(entry)) {
        logger.verbose('.contextbridge/ already in .gitignore');
        return;
      }
      // Append
      const newContent = content.endsWith('\n')
        ? content + `\n# ContextBridge handoff files\n${entry}\n`
        : content + `\n\n# ContextBridge handoff files\n${entry}\n`;
      fs.writeFileSync(gitignorePath, newContent, 'utf8');
      logger.success(`Added ${chalk.green(entry)} to .gitignore`);
    } else {
      // Create .gitignore
      fs.writeFileSync(
        gitignorePath,
        `# ContextBridge handoff files\n${entry}\n`,
        'utf8'
      );
      logger.success(`Created .gitignore with ${chalk.green(entry)}`);
    }
  } catch (err) {
    logger.warn(`Could not update .gitignore: ${err.message}`);
  }
}
