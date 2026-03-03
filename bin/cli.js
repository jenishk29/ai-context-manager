#!/usr/bin/env node

'use strict';

/**
 * AI Context Manager CLI — Entry Point
 *
 * Complete AI context management solution:
 * - Track context events across AI tool sessions
 * - Generate handoff snapshots for seamless AI tool switching
 * - Monitor token usage and context efficiency
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const { logger, setLogLevel } = require('../src/cli/logger');
const pkg = require('../package.json');

// Check Node.js version
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(
    chalk.red(`AI Context Manager requires Node.js >= 18.0.0. You are running ${process.versions.node}.`)
  );
  process.exit(1);
}

const cli = yargs(hideBin(process.argv))
  .scriptName('acm')
  .version(pkg.version)
  .usage('Usage: acm <command> [options]\n       ai-context-manager <command> [options]')
  .option('verbose', {
    alias: 'V',
    type: 'boolean',
    description: 'Enable verbose output',
    global: true,
  })
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress non-essential output',
    global: true,
  })
  .option('debug', {
    type: 'boolean',
    description: 'Enable debug logging',
    global: true,
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
    global: true,
  })
  .middleware((argv) => {
    if (argv.debug) {
      setLogLevel('debug');
    } else if (argv.verbose) {
      setLogLevel('verbose');
    } else if (argv.quiet) {
      setLogLevel('quiet');
    }
  })
  .command(require('../src/commands/init'))
  .command(require('../src/commands/snapshot'))
  .command(require('../src/commands/stats'))
  .command(require('../src/commands/doctor'))
  .command(require('../src/commands/validate'))
  .demandCommand(1, chalk.yellow('Please specify a command. Run with --help to see available commands.'))
  .strict()
  .alias('h', 'help')
  .epilogue('Tip: use the short alias `acm` instead of `ai-context-manager`.\nDocumentation: https://github.com/jenishk29/ai-context-manager')
  .fail((msg, err, yargs) => {
    if (err) {
      if (process.env.ACM_DEBUG || process.argv.includes('--debug')) {
        console.error(chalk.red('Error:'), err.stack || err.message);
      } else {
        console.error(chalk.red('Error:'), err.message);
        console.error(chalk.dim('Run with --debug for full stack trace.'));
      }
      process.exit(1);
    }
    if (msg) {
      console.error(chalk.yellow(msg));
      console.error('');
      yargs.showHelp();
    }
    process.exit(1);
  });

cli.parse();
