'use strict';

/**
 * `contextbridge snapshot` — Generate the AI handoff file.
 *
 * Collects project context, renders handoff markdown/JSON,
 * runs secret scan, and writes output files.
 */

const path = require('path');
const chalk = require('chalk');
const { loadConfig, checkStaleness, CONTEXTBRIDGE_DIR } = require('../core/configLoader');
const { validatePaths } = require('../core/pathResolver');
const { generateTree } = require('../core/treeGenerator');
const { collectGitContext, formatGitContext } = require('../core/gitCollector');
const { analyzeTokens, formatTokenAnalysis, checkSizeBudget } = require('../core/tokenEstimator');
const { renderHandoff, writeHandoffFiles } = require('../core/handoffRenderer');
const { scanForSecrets, formatScanResults } = require('../core/secretScanner');
const { lockedJsonUpdate } = require('../utils/filelock');
const { normalizePath } = require('../utils/platform');
const { logger } = require('../utils/logger');

// Optional integration with ai-context-events (Node) for cross-tool context tracking.
let ContextEventsManager = null;
try {
  // Prefer external package name if installed.
  // eslint-disable-next-line global-require
  ({ ContextManager: ContextEventsManager } = require('ai-context-events'));
} catch {
  try {
    // Fallback to local sibling package in this repo.
    // eslint-disable-next-line global-require
    ({ ContextManager: ContextEventsManager } = require('../../../context-events'));
  } catch {
    ContextEventsManager = null;
  }
}

let contextEventsInstance = null;

function logSnapshotContextEvent({ projectRoot, config, tokenAnalysis }) {
  if (!ContextEventsManager) return;
  if (!contextEventsInstance) {
    contextEventsInstance = new ContextEventsManager({
      storagePath: '.context-events/context.json',
      tool_id: 'contextbridge',
    });
  }

  try {
    contextEventsInstance.addEvent({
      operation: 'context_update',
      status: 'completed',
      context_data: {
        project_root: projectRoot,
        project_name: config.project.name,
        stack: config.project.stack,
        snapshot_tokens: tokenAnalysis.total,
        snapshot_chars: tokenAnalysis.charCount,
        snapshot_lines: tokenAnalysis.lineCount,
      },
      tokens_used: tokenAnalysis.total,
      notes: 'contextbridge snapshot generated handoff',
    });
  } catch (err) {
    // Surface as debug only; snapshot should not fail because of logging.
    logger.debug(`Context events logging failed: ${err.message || err}`);
  }
}

module.exports = {
  command: 'snapshot',
  describe: 'Generate an AI handoff file from your project context',
  builder: (yargs) => {
    return yargs
      .option('dry-run', {
        type: 'boolean',
        description: 'Preview the handoff without writing files',
        default: false,
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Skip secret scan warnings',
        default: false,
      })
      .option('copy', {
        type: 'boolean',
        description: 'Copy handoff content to clipboard',
        default: false,
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Custom output file path',
      })
      .option('format', {
        type: 'string',
        choices: ['md', 'json', 'both'],
        description: 'Output format (overrides config)',
      });
  },
  handler: async (argv) => {
    const projectRoot = process.cwd();

    // 1. Load and validate config
    logger.info('Loading config...');
    const { config, configPath, errors } = loadConfig(projectRoot, argv.config);

    if (errors.length > 0) {
      for (const err of errors) {
        logger.error(err);
      }
      logger.blank();
      logger.info(`Run ${chalk.cyan('acm init')} to create a config file.`);
      process.exit(2);
    }

    logger.success(`Config loaded from ${chalk.dim(path.basename(configPath))}`);

    // 2. Check staleness
    const staleness = checkStaleness(config);
    if (staleness.stale) {
      logger.warn(
        `Progress fields were last updated ${staleness.ageHours} hours ago.`
      );
      logger.info(chalk.dim('Consider updating your config before taking a snapshot.'));
      logger.blank();
    }

    // 3. Validate relevantFiles paths
    if (config.activeTask.relevantFiles.length > 0) {
      logger.verbose('Validating relevant files...');
      const { valid, errors: pathErrors } = validatePaths(
        projectRoot,
        config.activeTask.relevantFiles
      );

      if (pathErrors.length > 0) {
        for (const err of pathErrors) {
          logger.warn(err);
        }
      }

      // Replace with only valid paths
      config.activeTask.relevantFiles = valid.map((v) => normalizePath(
        path.relative(projectRoot, v.absolute)
      ));
    }

    // 4. Generate file tree
    logger.verbose('Generating file tree...');
    const treeResult = generateTree(projectRoot, {
      exclude: config._mergedExclude || config.exclude,
      maxDepth: config.options.treeDepth,
      maxEntries: config.options.maxTreeEntries,
      activeFiles: config.activeTask.relevantFiles,
    });

    if (treeResult.truncated) {
      logger.verbose(
        `File tree truncated: showing ${config.options.maxTreeEntries} of ${treeResult.totalFiles} entries.`
      );
    }

    // 5. Collect git context
    let gitContext = null;
    let gitContextRaw = null;
    if (config.options.includeGit) {
      logger.verbose('Collecting git context...');
      gitContextRaw = collectGitContext(projectRoot, {
        logCount: config.options.gitLogCount,
      });
      gitContext = formatGitContext(gitContextRaw);
    }

    // 6. Render handoff
    logger.info('Generating handoff...');
    const format = argv.format || config.options.format;

    const result = renderHandoff(
      {
        config,
        projectRoot,
        fileTree: treeResult.tree,
        gitContext,
        gitContextRaw,
        stackInfo: config.project.stack,
      },
      {
        format,
        maxTokens: config.options.maxTokens,
        force: argv.force,
        dryRun: argv.dryRun,
      }
    );

    // 7. Secret scan check
    if (result.secretScan.found && !argv.force) {
      logger.blank();
      logger.error('Potential secrets detected in handoff output!');
      logger.blank();
      logger.info(formatScanResults(result.secretScan));
      logger.blank();

      if (result.secretScan.critical.length > 0) {
        logger.error(
          `${result.secretScan.critical.length} critical secret(s) found. ` +
          `The handoff file is designed to be shared — do NOT include secrets.`
        );
        logger.info(`Use ${chalk.cyan('--force')} to generate anyway (at your own risk).`);
        process.exit(3);
      } else {
        logger.warn('Warnings found. Review the output carefully before sharing.');
      }
    }

    // 8. Write or preview
    if (argv.dryRun) {
      logger.blank();
      logger.section('DRY RUN — Handoff Preview');
      logger.blank();
      console.log(result.markdown);
      logger.blank();
      logger.section('Token Analysis');
      logger.info(formatTokenAnalysis(result.tokenAnalysis));
    } else {
      // Write files
      const written = writeHandoffFiles(result);
      logger.blank();

      for (const file of written) {
        logger.success(`Saved: ${chalk.green(normalizePath(path.relative(projectRoot, file)))}`);
      }

      // Update stats
      await updateStats(projectRoot, result.tokenAnalysis);

      // Token analysis
      logger.blank();
      logger.info(formatTokenAnalysis(result.tokenAnalysis));

      // Budget check
      const budget = checkSizeBudget(
        result.tokenAnalysis.total,
        config.options.maxTokens
      );
      if (!budget.withinBudget) {
        logger.blank();
        logger.warn(
          `Handoff is ${budget.percentage}% of your ${budget.budget}-token budget. ` +
          `Consider reducing content or increasing options.maxTokens.`
        );
      }
    }

    // 9. Copy to clipboard
    if (argv.copy && !argv.dryRun) {
      try {
        const clipboardy = require('clipboardy');
        clipboardy.writeSync(result.markdown);
        logger.blank();
        logger.success('Handoff copied to clipboard!');
      } catch {
        logger.warn('Could not copy to clipboard. Install clipboardy or copy the file manually.');
      }
    }

    logger.blank();
    if (!argv.dryRun) {
      // Optionally record a context_update event for cross-tool consumers.
      logSnapshotContextEvent({ projectRoot, config, tokenAnalysis: result.tokenAnalysis });
    }

    if (!argv.dryRun) {
      logger.info(
        chalk.dim('Paste the handoff file into your new AI session to resume development.')
      );
    }
  },
};

/**
 * Update stats.json with this snapshot's data.
 */
async function updateStats(projectRoot, tokenAnalysis) {
  const statsPath = path.join(projectRoot, CONTEXTBRIDGE_DIR, 'stats.json');

  try {
    await lockedJsonUpdate(statsPath, (stats) => {
      if (!stats.snapshots) stats.snapshots = [];
      if (!stats.totalSnapshots) stats.totalSnapshots = 0;
      if (!stats.totalTokens) stats.totalTokens = 0;

      stats.snapshots.push({
        timestamp: new Date().toISOString(),
        tokens: tokenAnalysis.total,
        chars: tokenAnalysis.charCount,
        lines: tokenAnalysis.lineCount,
      });

      // Keep last 100 snapshots
      if (stats.snapshots.length > 100) {
        stats.snapshots = stats.snapshots.slice(-100);
      }

      stats.totalSnapshots += 1;
      stats.totalTokens += tokenAnalysis.total;
      stats.lastSnapshot = new Date().toISOString();

      return stats;
    });
  } catch (err) {
    logger.debug(`Failed to update stats: ${err.message}`);
  }
}
