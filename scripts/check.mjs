#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function assertExists(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing required path: ${relativePath}`);
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listFiles(relativeDir, extension) {
  const base = path.join(root, relativeDir);
  if (!fs.existsSync(base)) {
    return [];
  }

  const results = [];

  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const entryPath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      for (const nested of listFiles(path.join(relativeDir, entry.name), extension)) {
        results.push(nested);
      }
      continue;
    }

    if (entry.name.endsWith(extension)) {
      results.push(path.join(relativeDir, entry.name));
    }
  }

  return results;
}

const manifestPath = 'gemini-extension.json';
assertExists(manifestPath);

let manifest;
try {
  manifest = JSON.parse(readText(manifestPath));
} catch (error) {
  fail(`Invalid JSON in ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
}

for (const field of ['name', 'version', 'description']) {
  if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
    fail(`Manifest field "${field}" must be a non-empty string.`);
  }
}

const contextFileName = manifest.contextFileName ?? 'GEMINI.md';
assertExists(contextFileName);
assertExists('README.md');
assertExists('hooks/hooks.json');
assertExists('commands');
assertExists('skills');
assertExists('agents');
assertExists('policies');

if (!manifest.plan || typeof manifest.plan.directory !== 'string' || !manifest.plan.directory.trim()) {
  fail('Manifest must define plan.directory.');
}

assertExists(manifest.plan.directory);

const commandFiles = listFiles('commands', '.toml');
if (commandFiles.length === 0) {
  fail('Expected at least one command TOML file.');
}

for (const file of commandFiles) {
  const content = readText(file);
  if (!/\bprompt\s*=/.test(content)) {
    fail(`Command file is missing a prompt field: ${file}`);
  }
}

const skillFiles = listFiles('skills', 'SKILL.md');
if (skillFiles.length === 0) {
  fail('Expected at least one SKILL.md file.');
}

for (const file of skillFiles) {
  const content = readText(file);
  if (!content.startsWith('---\n')) {
    fail(`Skill file must start with YAML frontmatter: ${file}`);
  }
}

const agentFiles = listFiles('agents', '.md');
if (agentFiles.length === 0) {
  fail('Expected at least one agent markdown file.');
}

for (const file of agentFiles) {
  const content = readText(file);
  if (!content.startsWith('---\n')) {
    fail(`Agent file must start with YAML frontmatter: ${file}`);
  }
}

const hooksConfig = JSON.parse(readText('hooks/hooks.json'));
if (!hooksConfig.hooks || typeof hooksConfig.hooks !== 'object') {
  fail('hooks/hooks.json must contain a top-level "hooks" object.');
}

process.stdout.write(
  [
    'Blueprint scaffold check passed.',
    `Manifest: ${manifest.name}@${manifest.version}`,
    `Commands: ${commandFiles.length}`,
    `Skills: ${skillFiles.length}`,
    `Agents: ${agentFiles.length}`
  ].join('\n') + '\n'
);
