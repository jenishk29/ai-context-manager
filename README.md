# @jenishk29/ai-context-manager

> **The fastest way to hand off AI context** — generate rich project snapshots for ChatGPT, Claude, Gemini, Copilot, and any other AI tool. Never lose context when switching models or starting a new session.

[![npm version](https://img.shields.io/npm/v/@jenishk29/ai-context-manager?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@jenishk29/ai-context-manager)
[![npm downloads](https://img.shields.io/npm/dm/@jenishk29/ai-context-manager?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@jenishk29/ai-context-manager)
[![Node.js](https://img.shields.io/node/v/@jenishk29/ai-context-manager?style=flat-square&color=339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/jenishk29/ai-context-manager?style=flat-square)](https://github.com/jenishk29/ai-context-manager/stargazers)

```bash
npm install -g @jenishk29/ai-context-manager
acm snapshot   # → HANDOFF.md in seconds
```

---

## Table of Contents

- [Why](#why)
- [Install](#install)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
  - [acm init](#acm-init)
  - [acm snapshot](#acm-snapshot)
  - [acm stats](#acm-stats)
  - [acm validate](#acm-validate)
  - [acm doctor](#acm-doctor)
- [Configuration](#configuration)
- [Library API](#library-api)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Why

Every time you switch AI tools or hit a context limit, you lose momentum. Copy-pasting files and re-explaining your project wastes time.

`acm snapshot` generates a single comprehensive handoff file containing:

- 📁 **Directory tree** — full project structure
- 🔀 **Git context** — branch, recent commits, status
- 🧩 **Stack detection** — auto-detected technologies
- ✅ **Progress tracking** — what's done, in progress, and next
- 🎯 **Active task** — exactly what you're working on
- 📄 **Relevant files** — embedded code your AI needs
- 🔒 **Secret scanning** — never accidentally leak credentials
- 🔢 **Token estimate** — know the size before you paste

Paste it into any AI. Zero re-explaining.

---

## Install

### Global (recommended — enables `acm` CLI)

```bash
npm install -g @jenishk29/ai-context-manager
```

Both `acm` and `ai-context-manager` are available as commands. Use `acm` — it's faster to type.

```bash
acm --version
acm --help
```

### Local (library / programmatic use)

```bash
npm install @jenishk29/ai-context-manager
```

**Requirements:** Node.js ≥ 18.0.0

---

## Quick Start

```bash
# 1. Install globally
npm install -g @jenishk29/ai-context-manager

# 2. Go to your project
cd my-project

# 3. Initialize (once per project)
acm init

# 4. Fill in .contextbridge.json — add your current task & progress

# 5. Generate handoff file
acm snapshot

# 6. Paste HANDOFF.md into your AI and keep working instantly
```

---

## CLI Commands

### `acm init`

Initialize AI Context Manager in your project. Auto-detects stack and project name.

```bash
acm init                 # interactive
acm init -y              # accept all defaults (CI-friendly)
acm init --force         # overwrite existing config
```

Creates `.contextbridge.json` at your project root. Commit this file — it's how your team shares context state. The generated `.contextbridge/` directory (handoff files) is git-ignored automatically.

**Output:**

```
Initializing AI Context Manager...

Detecting project stack...
✔ Detected: node, typescript, react
  Project name: my-app

✔ Created .contextbridge.json
✔ Created .contextbridge/ directory
✔ Added .contextbridge/ to .gitignore

Setup complete!

Next steps:
   1. Edit .contextbridge.json to add your progress & context
   2. Run acm snapshot to generate a handoff file
   3. Paste the handoff into your new AI session
```

---

### `acm snapshot`

Generate the AI handoff file. The core command.

```bash
acm snapshot                          # generates HANDOFF.md + HANDOFF.json
acm snapshot --copy                   # also copies to clipboard instantly
acm snapshot --dry-run                # preview without writing files
acm snapshot -o docs/handoff.md      # custom output path
acm snapshot --format md             # markdown only
acm snapshot --format json           # json only
acm snapshot --format both           # both (default)
acm snapshot --force                 # skip secret-scan warnings
```

**Options:**

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--output` | `-o` | `HANDOFF.md` | Output file path |
| `--format` | | `both` | `md`, `json`, or `both` |
| `--copy` | | `false` | Copy output to clipboard |
| `--dry-run` | | `false` | Preview without writing files |
| `--force` | `-f` | `false` | Skip secret-scan block |

**Generated snapshot includes:**

```markdown
# AI Handoff — my-app
Generated: 2026-03-03T06:00:00Z  |  Tokens: ~3,200

## Project
Stack: node · typescript · react

## Progress
✅ Completed: User auth, DB schema
🔄 In Progress: Payment integration
📋 Next: Email notifications

## Active Task
Implement Stripe payment flow
Files: src/payments/stripe.ts, src/api/checkout.ts

## Directory Tree
my-app/
├── src/
│   ├── payments/

## Git Context
Branch: feature/stripe  |  Last commit: "Add checkout endpoint"
```

> **Secret scanning** is automatic. The command blocks on critical secrets (API keys, tokens, private keys) and warns on suspicious patterns. Use `--force` to override at your own risk.

---

### `acm stats`

Show snapshot history and token usage.

```bash
acm stats                # summary + recent snapshots
acm stats --last 5       # show last 5 only
acm stats --json         # raw JSON output (pipe-friendly)
```

**Output:**

```
ContextBridge Statistics

   Total snapshots:         24
   Total tokens generated:  78,400
   Last snapshot:           3/3/2026, 11:52:00 AM
   Avg tokens per snapshot: 3,267

Recent snapshots:
  Date                     Tokens    Lines
  ────────────────────────────────────────
  3/3/2026, 11:52:00 AM    3,267      412
```

---

### `acm validate`

Validate your `.contextbridge.json` config file.

```bash
acm validate
```

Checks:
- ✅ Valid JSON syntax
- ✅ Schema compliance
- ✅ All `relevantFiles` paths exist on disk
- ⚠️ Warns if progress fields are empty
- ⚠️ Warns if active task description is missing
- ⚠️ Warns if project name is unset

---

### `acm doctor`

Full health check on your setup.

```bash
acm doctor
```

**Output:**

```
ContextBridge Doctor

  ✔ Node.js version: 20.11.0
  ℹ Platform: darwin arm64
  ✔ Config file found: .contextbridge.json
  ✔ Config file is valid JSON and passes schema validation
  ✔ All 3 relevant files exist and are valid
  ✔ .contextbridge/ directory exists
  ✔ .contextbridge/ is writable
  ✔ Disk space: 142,311 MB available
  ✔ Git is available
  ✔ Project is a git repository
  ✔ .contextbridge/ is in .gitignore

11 passed, 0 failed, 0 warnings
```

---

## Configuration

`.contextbridge.json` lives at your project root and drives every snapshot.

```json
{
  "schemaVersion": "1.0",
  "project": {
    "name": "my-app",
    "stack": ["node", "typescript", "react"],
    "description": "AI-powered productivity app",
    "environment": {
      "languageVersion": "Node.js 20.x",
      "frameworkVersions": ["React 18", "Next.js 14"],
      "runtimeNotes": "Requires PostgreSQL 15+"
    }
  },
  "progress": {
    "completed": ["User authentication", "Database schema"],
    "inProgress": ["Stripe payment integration"],
    "nextSteps": ["Email notifications", "Admin dashboard"],
    "blockers": [],
    "lastUpdated": "2026-03-03T06:00:00.000Z"
  },
  "activeTask": {
    "description": "Implement Stripe checkout flow",
    "relevantFiles": [
      "src/payments/stripe.ts",
      "src/api/checkout.ts"
    ],
    "steps": [
      "1. Set up Stripe webhooks",
      "2. Create checkout session endpoint",
      "3. Handle payment success/failure"
    ],
    "codeHints": [
      "Use stripe SDK v12+",
      "Store webhook secret in env as STRIPE_WEBHOOK_SECRET"
    ]
  },
  "architecture": {
    "overview": "Next.js app with API routes and PostgreSQL via Prisma",
    "patterns": ["Repository pattern", "Service layer"],
    "constraints": [
      "No direct DB queries in components",
      "All API routes must validate input with Zod"
    ],
    "protectedAreas": ["src/core/auth.ts", "src/db/migrations/"]
  },
  "exclude": ["coverage/", "*.generated.ts"],
  "options": {
    "maxTokens": 8000,
    "format": "both",
    "treeDepth": 4,
    "maxTreeEntries": 200,
    "includeGit": true,
    "gitLogCount": 5,
    "readBudget": {
      "maxRelevantFiles": 10,
      "allowExtraReads": true
    }
  }
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `project.stack` | Auto-detected on `acm init`, update as needed |
| `progress` | The heart of the handoff — **keep this updated** |
| `activeTask.relevantFiles` | These files are fully embedded in the snapshot |
| `activeTask.codeHints` | Constraints to prime your AI's understanding |
| `options.maxTokens` | Budget guard — warns if snapshot exceeds this |
| `exclude` | Additional patterns on top of built-in security exclusions |

**Built-in security exclusions** (always applied, cannot be overridden):

`.env*` · `*.pem` · `*.key` · `*.cert` · `node_modules/` · `.git/` · `dist/` · `build/` · lock files · Terraform state · database files · credential files

---

## Library API

Track AI context events programmatically across sessions and tools.

### Basic Usage

```typescript
import { ContextManager } from '@jenishk29/ai-context-manager';

const manager = new ContextManager({
  storagePath: '.context-events/context.json',
  tool_id: 'claude-3',
  prunePolicy: {
    max_events: 500,
    max_age_days: 90
  }
});

// Track an AI interaction
const event = manager.addEvent({
  operation: 'code_generation',
  status: 'completed',
  context_data: {
    prompt: 'Create user authentication',
    files_modified: ['auth.ts', 'user.ts']
  },
  tokens_used: 1200,
  notes: 'Generated JWT authentication'
});

// Export for use in another AI session or tool
const exported = manager.export();
console.log(`Token savings: ${exported.token_savings}`);
```

### Constructor Options

```typescript
interface ContextManagerOptions {
  storagePath?: string;       // Default: '.context-events/context.json'
  inMemory?: boolean;         // Default: false  — set true for testing
  user_id?: string;           // Optional default user ID
  tool_id?: string;           // Optional default AI tool identifier
  prunePolicy?: {
    max_events?: number;      // Default: 500
    max_age_days?: number;    // Default: 90
    drop_statuses?: string[]; // Default: ['aborted']
  };
  tokenEstimator?: (value: unknown) => number;  // Custom token counter
}
```

### Full API

```typescript
// ── Event management ──────────────────────────────────────────
manager.addEvent(input)                             // create event
manager.updateEvent(event_id, patch)                // update fields
manager.abortEvent(event_id, { notes? })            // mark aborted
manager.removeEvent(event_id)                       // hard delete

// ── History ───────────────────────────────────────────────────
manager.getHistory({ order, limit, tool_id, user_id, operation, status })

// ── Import / Export ───────────────────────────────────────────
manager.export({ prune? })                          // export snapshot
manager.import(data, { mode: 'replace' | 'merge' }) // import snapshot

// ── Optimization ──────────────────────────────────────────────
manager.prune({ max_events, max_age_days, drop_statuses })
manager.rollbackToEvent(event_id, { preserve_removed_as_aborted? })

// ── Diagnostics ───────────────────────────────────────────────
manager.validateAccuracy({ expected_operations?, expected_pending? })
manager.clearErrors()
```

### Cross-Tool Context Sharing

```typescript
// Session 1 — Claude does architecture
const claude = new ContextManager({ tool_id: 'claude-3' });
claude.addEvent({
  operation: 'architecture_design',
  status: 'completed',
  context_data: { pattern: 'microservices', services: ['user', 'order'] },
  tokens_used: 1500,
  notes: 'Designed system architecture'
});

// Session 2 — GPT-4 picks up where Claude left off
const gpt = new ContextManager({ tool_id: 'gpt-4' });
gpt.import(claude.export());
// GPT-4 now has full context of what Claude did
```

### In-Memory Mode (Testing)

```typescript
const manager = new ContextManager({ inMemory: true });
// Zero disk I/O — perfect for unit tests
```

### Schemas

```typescript
import { schemas } from '@jenishk29/ai-context-manager';

schemas.context_event  // ContextEvent JSON Schema
schemas.export         // ContextExport JSON Schema
schemas.functions      // Function call schemas
```

---

## Environment Variables

```bash
ACM_DEBUG=1                          # enable debug logging
ACM_STORAGE_PATH=.custom-context/   # override default storage path
ACM_DEFAULT_TOOL=claude-3-opus       # set default tool_id for events
```

---

## Contributing

Contributions are welcome! Please open an issue before submitting a PR for major changes.

```bash
# Clone and setup
git clone https://github.com/jenishk29/ai-context-manager.git
cd ai-context-manager
npm install

# Build
npm run build

# Lint & format
npm run lint
npm run format

# Type check
npm run typecheck
```

---

## License

MIT © 2026 [Jenish Kheni](https://github.com/jenishk29) — see [LICENSE](LICENSE) for full text.
