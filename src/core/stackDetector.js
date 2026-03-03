'use strict';

/**
 * Stack Detector — Auto-detects technology stack from project files.
 *
 * Parses actual file contents (JSON, TOML, etc.) instead of simple string matching.
 * Returns detected stack with confidence levels and source information.
 */

const fs = require('fs');
const path = require('path');
const { readFileUTF8 } = require('../utils/platform');
const { logger } = require('../utils/logger');

/**
 * Detection result:
 * { name: string, confidence: 'high'|'medium'|'low', source: string }
 */

/**
 * Detect the technology stack used in the project.
 * @param {string} rootDir - Absolute path to project root
 * @returns {{ stack: Array<{name: string, confidence: string, source: string}>, projectName: string|null }}
 */
function detectStack(rootDir) {
  const detected = [];
  let projectName = null;

  // --- Node.js / JavaScript ecosystem ---
  projectName = detectNodeStack(rootDir, detected) || projectName;

  // --- Go ---
  projectName = detectGoStack(rootDir, detected) || projectName;

  // --- Python ---
  projectName = detectPythonStack(rootDir, detected) || projectName;

  // --- Rust ---
  projectName = detectRustStack(rootDir, detected) || projectName;

  // --- Java ---
  detectJavaStack(rootDir, detected);

  // --- .NET / C# ---
  projectName = detectDotNetStack(rootDir, detected) || projectName;

  // --- Ruby ---
  detectRubyStack(rootDir, detected);

  // --- PHP ---
  detectPHPStack(rootDir, detected);

  // --- Dart / Flutter ---
  projectName = detectDartStack(rootDir, detected) || projectName;

  // --- Monorepo detection ---
  detectMonorepo(rootDir, detected);

  // --- Fallback: try folder name ---
  if (!projectName) {
    projectName = path.basename(rootDir);
  }

  // Deduplicate by name
  const seen = new Set();
  const unique = detected.filter((d) => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });

  return { stack: unique, projectName };
}

// ─── Node.js / JavaScript ───

function detectNodeStack(rootDir, detected) {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  let pkg;
  try {
    pkg = JSON.parse(readFileUTF8(pkgPath));
  } catch {
    logger.debug('Failed to parse package.json');
    return null;
  }

  const projectName = pkg.name || null;
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Frameworks (order: most specific first)
  const nodeChecks = [
    // Meta-frameworks
    { dep: 'next', name: 'Next.js', confidence: 'high' },
    { dep: 'nuxt', name: 'Nuxt', confidence: 'high' },
    { dep: '@sveltejs/kit', name: 'SvelteKit', confidence: 'high' },
    { dep: '@remix-run/react', name: 'Remix', confidence: 'high' },
    { dep: '@angular/core', name: 'Angular', confidence: 'high' },

    // Frontend
    { dep: 'react', name: 'React', confidence: 'high' },
    { dep: 'react-native', name: 'React Native', confidence: 'high' },
    { dep: 'vue', name: 'Vue.js', confidence: 'high' },
    { dep: 'svelte', name: 'Svelte', confidence: 'high' },
    { dep: 'solid-js', name: 'SolidJS', confidence: 'high' },
    { dep: 'preact', name: 'Preact', confidence: 'high' },

    // State management
    { dep: 'redux', name: 'Redux', confidence: 'medium' },
    { dep: '@reduxjs/toolkit', name: 'Redux Toolkit', confidence: 'medium' },
    { dep: 'zustand', name: 'Zustand', confidence: 'medium' },

    // Backend frameworks
    { dep: 'express', name: 'Express', confidence: 'high' },
    { dep: 'fastify', name: 'Fastify', confidence: 'high' },
    { dep: 'koa', name: 'Koa', confidence: 'high' },
    { dep: 'hapi', name: 'Hapi', confidence: 'high' },
    { dep: '@nestjs/core', name: 'NestJS', confidence: 'high' },
    { dep: 'hono', name: 'Hono', confidence: 'high' },

    // ORMs / DB
    { dep: 'prisma', name: 'Prisma', confidence: 'medium' },
    { dep: '@prisma/client', name: 'Prisma', confidence: 'medium' },
    { dep: 'drizzle-orm', name: 'Drizzle', confidence: 'medium' },
    { dep: 'sequelize', name: 'Sequelize', confidence: 'medium' },
    { dep: 'typeorm', name: 'TypeORM', confidence: 'medium' },
    { dep: 'mongoose', name: 'Mongoose', confidence: 'medium' },

    // Testing
    { dep: 'jest', name: 'Jest', confidence: 'low' },
    { dep: 'vitest', name: 'Vitest', confidence: 'low' },
    { dep: 'mocha', name: 'Mocha', confidence: 'low' },

    // Build tools
    { dep: 'vite', name: 'Vite', confidence: 'low' },
    { dep: 'webpack', name: 'Webpack', confidence: 'low' },
    { dep: 'esbuild', name: 'esbuild', confidence: 'low' },
    { dep: 'turbopack', name: 'Turbopack', confidence: 'low' },

    // TypeScript
    { dep: 'typescript', name: 'TypeScript', confidence: 'medium' },
  ];

  detected.push({ name: 'Node.js', confidence: 'high', source: 'package.json' });

  for (const check of nodeChecks) {
    if (allDeps && allDeps[check.dep]) {
      detected.push({
        name: check.name,
        confidence: check.confidence,
        source: `package.json (${check.dep})`,
      });
    }
  }

  return projectName;
}

// ─── Go ───

function detectGoStack(rootDir, detected) {
  const goModPath = path.join(rootDir, 'go.mod');
  if (!fs.existsSync(goModPath)) return null;

  detected.push({ name: 'Go', confidence: 'high', source: 'go.mod' });

  let projectName = null;
  try {
    const content = readFileUTF8(goModPath);
    const moduleMatch = content.match(/^module\s+(.+)$/m);
    if (moduleMatch) {
      const moduleName = moduleMatch[1].trim();
      projectName = moduleName.split('/').pop();
    }

    // Detect Go frameworks
    const goChecks = [
      { dep: 'github.com/gin-gonic/gin', name: 'Gin', confidence: 'high' },
      { dep: 'github.com/gofiber/fiber', name: 'Fiber', confidence: 'high' },
      { dep: 'github.com/labstack/echo', name: 'Echo', confidence: 'high' },
      { dep: 'github.com/gorilla/mux', name: 'Gorilla Mux', confidence: 'high' },
      { dep: 'gorm.io/gorm', name: 'GORM', confidence: 'medium' },
      { dep: 'github.com/jmoiron/sqlx', name: 'sqlx', confidence: 'medium' },
      { dep: 'github.com/graphql-go/graphql', name: 'GraphQL', confidence: 'medium' },
      { dep: 'google.golang.org/grpc', name: 'gRPC', confidence: 'medium' },
    ];

    for (const check of goChecks) {
      if (content.includes(check.dep)) {
        detected.push({
          name: check.name,
          confidence: check.confidence,
          source: `go.mod (${check.dep})`,
        });
      }
    }
  } catch {
    logger.debug('Failed to parse go.mod');
  }

  return projectName;
}

// ─── Python ───

function detectPythonStack(rootDir, detected) {
  let projectName = null;

  // Check pyproject.toml first (modern Python)
  const pyprojectPath = path.join(rootDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    detected.push({ name: 'Python', confidence: 'high', source: 'pyproject.toml' });
    try {
      const content = readFileUTF8(pyprojectPath);
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (nameMatch) projectName = nameMatch[1];

      const pyChecks = [
        { dep: 'django', name: 'Django', confidence: 'high' },
        { dep: 'fastapi', name: 'FastAPI', confidence: 'high' },
        { dep: 'flask', name: 'Flask', confidence: 'high' },
        { dep: 'starlette', name: 'Starlette', confidence: 'high' },
        { dep: 'sqlalchemy', name: 'SQLAlchemy', confidence: 'medium' },
        { dep: 'celery', name: 'Celery', confidence: 'medium' },
        { dep: 'pytest', name: 'pytest', confidence: 'low' },
        { dep: 'numpy', name: 'NumPy', confidence: 'medium' },
        { dep: 'pandas', name: 'Pandas', confidence: 'medium' },
        { dep: 'tensorflow', name: 'TensorFlow', confidence: 'high' },
        { dep: 'torch', name: 'PyTorch', confidence: 'high' },
        { dep: 'scikit-learn', name: 'scikit-learn', confidence: 'medium' },
      ];

      for (const check of pyChecks) {
        if (content.toLowerCase().includes(check.dep)) {
          detected.push({
            name: check.name,
            confidence: check.confidence,
            source: `pyproject.toml`,
          });
        }
      }
    } catch {
      logger.debug('Failed to parse pyproject.toml');
    }
    return projectName;
  }

  // Check requirements.txt
  const reqPath = path.join(rootDir, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    detected.push({ name: 'Python', confidence: 'high', source: 'requirements.txt' });
    try {
      const lines = readFileUTF8(reqPath).split('\n').map((l) => l.trim().toLowerCase().split(/[=<>!~]/)[0]);
      const pyChecks = [
        { dep: 'django', name: 'Django' },
        { dep: 'fastapi', name: 'FastAPI' },
        { dep: 'flask', name: 'Flask' },
        { dep: 'sqlalchemy', name: 'SQLAlchemy' },
        { dep: 'celery', name: 'Celery' },
        { dep: 'numpy', name: 'NumPy' },
        { dep: 'pandas', name: 'Pandas' },
        { dep: 'tensorflow', name: 'TensorFlow' },
        { dep: 'torch', name: 'PyTorch' },
        { dep: 'scikit-learn', name: 'scikit-learn' },
      ];
      for (const check of pyChecks) {
        if (lines.includes(check.dep)) {
          detected.push({
            name: check.name,
            confidence: 'high',
            source: 'requirements.txt',
          });
        }
      }
    } catch {
      logger.debug('Failed to parse requirements.txt');
    }
    return null;
  }

  // Check Pipfile
  const pipfilePath = path.join(rootDir, 'Pipfile');
  if (fs.existsSync(pipfilePath)) {
    detected.push({ name: 'Python', confidence: 'high', source: 'Pipfile' });
    return null;
  }

  // Check setup.py (legacy)
  const setupPath = path.join(rootDir, 'setup.py');
  if (fs.existsSync(setupPath)) {
    detected.push({ name: 'Python', confidence: 'high', source: 'setup.py' });
    return null;
  }

  return projectName;
}

// ─── Rust ───

function detectRustStack(rootDir, detected) {
  const cargoPath = path.join(rootDir, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return null;

  detected.push({ name: 'Rust', confidence: 'high', source: 'Cargo.toml' });

  let projectName = null;
  try {
    const content = readFileUTF8(cargoPath);
    const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
    if (nameMatch) projectName = nameMatch[1];

    const rustChecks = [
      { dep: 'actix-web', name: 'Actix Web' },
      { dep: 'axum', name: 'Axum' },
      { dep: 'rocket', name: 'Rocket' },
      { dep: 'tokio', name: 'Tokio' },
      { dep: 'diesel', name: 'Diesel' },
      { dep: 'sqlx', name: 'SQLx' },
      { dep: 'serde', name: 'Serde' },
    ];

    for (const check of rustChecks) {
      if (content.includes(check.dep)) {
        detected.push({
          name: check.name,
          confidence: 'high',
          source: `Cargo.toml`,
        });
      }
    }
  } catch {
    logger.debug('Failed to parse Cargo.toml');
  }

  return projectName;
}

// ─── Java ───

function detectJavaStack(rootDir, detected) {
  if (fs.existsSync(path.join(rootDir, 'pom.xml'))) {
    detected.push({ name: 'Java (Maven)', confidence: 'high', source: 'pom.xml' });

    try {
      const content = readFileUTF8(path.join(rootDir, 'pom.xml'));
      if (content.includes('spring-boot')) {
        detected.push({ name: 'Spring Boot', confidence: 'high', source: 'pom.xml' });
      }
    } catch { /* ignore */ }
    return;
  }

  if (fs.existsSync(path.join(rootDir, 'build.gradle')) || fs.existsSync(path.join(rootDir, 'build.gradle.kts'))) {
    detected.push({ name: 'Java/Kotlin (Gradle)', confidence: 'high', source: 'build.gradle' });

    try {
      const gradleFile = fs.existsSync(path.join(rootDir, 'build.gradle.kts'))
        ? 'build.gradle.kts' : 'build.gradle';
      const content = readFileUTF8(path.join(rootDir, gradleFile));
      if (content.includes('spring-boot')) {
        detected.push({ name: 'Spring Boot', confidence: 'high', source: gradleFile });
      }
      if (content.includes('kotlin')) {
        detected.push({ name: 'Kotlin', confidence: 'high', source: gradleFile });
      }
    } catch { /* ignore */ }
  }
}

// ─── .NET / C# ───

function detectDotNetStack(rootDir, detected) {
  // Look for .csproj or .sln files
  try {
    const files = fs.readdirSync(rootDir);
    const csproj = files.find((f) => f.endsWith('.csproj'));
    const sln = files.find((f) => f.endsWith('.sln'));

    if (csproj || sln) {
      detected.push({ name: '.NET / C#', confidence: 'high', source: csproj || sln });

      if (csproj) {
        try {
          const content = readFileUTF8(path.join(rootDir, csproj));
          if (content.includes('Microsoft.AspNetCore')) {
            detected.push({ name: 'ASP.NET Core', confidence: 'high', source: csproj });
          }
          if (content.includes('Blazor')) {
            detected.push({ name: 'Blazor', confidence: 'high', source: csproj });
          }
        } catch { /* ignore */ }
      }

      return path.basename(csproj || sln, path.extname(csproj || sln));
    }
  } catch { /* ignore */ }

  return null;
}

// ─── Ruby ───

function detectRubyStack(rootDir, detected) {
  const gemfilePath = path.join(rootDir, 'Gemfile');
  if (!fs.existsSync(gemfilePath)) return;

  detected.push({ name: 'Ruby', confidence: 'high', source: 'Gemfile' });

  try {
    const content = readFileUTF8(gemfilePath);
    if (content.includes("'rails'") || content.includes('"rails"')) {
      detected.push({ name: 'Ruby on Rails', confidence: 'high', source: 'Gemfile' });
    }
    if (content.includes("'sinatra'") || content.includes('"sinatra"')) {
      detected.push({ name: 'Sinatra', confidence: 'high', source: 'Gemfile' });
    }
  } catch { /* ignore */ }
}

// ─── PHP ───

function detectPHPStack(rootDir, detected) {
  const composerPath = path.join(rootDir, 'composer.json');
  if (!fs.existsSync(composerPath)) return;

  detected.push({ name: 'PHP', confidence: 'high', source: 'composer.json' });

  try {
    const pkg = JSON.parse(readFileUTF8(composerPath));
    const allDeps = { ...pkg.require, ...pkg['require-dev'] };

    if (allDeps['laravel/framework']) {
      detected.push({ name: 'Laravel', confidence: 'high', source: 'composer.json' });
    }
    if (allDeps['symfony/symfony'] || allDeps['symfony/framework-bundle']) {
      detected.push({ name: 'Symfony', confidence: 'high', source: 'composer.json' });
    }
  } catch { /* ignore */ }
}

// ─── Dart / Flutter ───

function detectDartStack(rootDir, detected) {
  const pubspecPath = path.join(rootDir, 'pubspec.yaml');
  if (!fs.existsSync(pubspecPath)) return null;

  let projectName = null;
  try {
    const content = readFileUTF8(pubspecPath);
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    if (nameMatch) projectName = nameMatch[1].trim();

    if (content.includes('flutter:')) {
      detected.push({ name: 'Flutter', confidence: 'high', source: 'pubspec.yaml' });
    } else {
      detected.push({ name: 'Dart', confidence: 'high', source: 'pubspec.yaml' });
    }
  } catch { /* ignore */ }

  return projectName;
}

// ─── Monorepo ───

function detectMonorepo(rootDir, detected) {
  const checks = [
    { file: 'lerna.json', name: 'Lerna monorepo' },
    { file: 'nx.json', name: 'Nx monorepo' },
    { file: 'turbo.json', name: 'Turborepo' },
    { file: 'pnpm-workspace.yaml', name: 'pnpm workspace' },
    { file: 'rush.json', name: 'Rush monorepo' },
  ];

  for (const check of checks) {
    if (fs.existsSync(path.join(rootDir, check.file))) {
      detected.push({
        name: check.name,
        confidence: 'high',
        source: check.file,
      });
    }
  }

  // Check package.json workspaces
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileUTF8(pkgPath));
      if (pkg.workspaces) {
        detected.push({
          name: 'npm/yarn workspaces',
          confidence: 'high',
          source: 'package.json (workspaces)',
        });
      }
    } catch { /* ignore */ }
  }
}

module.exports = { detectStack };
