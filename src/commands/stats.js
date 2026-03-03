'use strict';

/**
 * `ai-context-manager stats` — Show snapshot history and token usage.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { CONTEXTBRIDGE_DIR } = require('../core/configLoader');
const { readFileUTF8 } = require('../utils/platform');
const { logger } = require('../utils/logger');

module.exports = {
  command: 'stats',
  describe: 'Show snapshot history and token usage statistics',
  builder: (yargs) => {
    return yargs
      .option('json', {
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      })
      .option('last', {
        alias: 'n',
        type: 'number',
        description: 'Show only the last N snapshots',
        default: 10,
      });
  },
  handler: (argv) => {
    const projectRoot = process.cwd();
    const statsPath = path.join(projectRoot, CONTEXTBRIDGE_DIR, 'stats.json');

    if (!fs.existsSync(statsPath)) {
      logger.info('No snapshot history yet.');
      logger.info(`Run ${chalk.cyan('acm snapshot')} to create your first handoff.`);
      process.exit(0);
    }

    let stats;
    try {
      stats = JSON.parse(readFileUTF8(statsPath));
    } catch (err) {
      logger.error(`Failed to read stats: ${err.message}`);
      process.exit(1);
    }

    if (argv.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    // Display stats
    logger.section('AI Context Manager Statistics');
    logger.blank();
    logger.kv('Total snapshots', stats.totalSnapshots || 0);
    logger.kv('Total tokens generated', (stats.totalTokens || 0).toLocaleString());
    logger.kv('Last snapshot', stats.lastSnapshot
      ? new Date(stats.lastSnapshot).toLocaleString()
      : 'never');

    if (stats.totalSnapshots > 0) {
      const avgTokens = Math.round((stats.totalTokens || 0) / stats.totalSnapshots);
      logger.kv('Avg tokens per snapshot', avgTokens.toLocaleString());
    }

    // Recent snapshots
    if (stats.snapshots && stats.snapshots.length > 0) {
      logger.blank();
      logger.info(chalk.bold('Recent snapshots:'));
      logger.blank();

      const recent = stats.snapshots.slice(-argv.last).reverse();
      const header = `  ${'Date'.padEnd(22)} ${'Tokens'.padStart(8)} ${'Lines'.padStart(7)}`;
      logger.info(chalk.dim(header));
      logger.info(chalk.dim('  ' + '-'.repeat(header.length - 2)));

      for (const snap of recent) {
        const date = new Date(snap.timestamp).toLocaleString();
        const tokens = (snap.tokens || 0).toLocaleString().padStart(8);
        const lines = (snap.lines || 0).toString().padStart(7);
        logger.info(`  ${date.padEnd(22)} ${tokens} ${lines}`);
      }
    }

    logger.blank();
  },
};
