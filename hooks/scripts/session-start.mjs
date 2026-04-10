#!/usr/bin/env node

import process from 'node:process';

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const source = input.source ?? 'startup';

  const additionalContext = [
    'Blueprint extension scaffold is active.',
    'Use /blueprint:help to inspect the current workflow surface.',
    'Current scaffold includes commands, skills, agents, a starter hook, and a plan directory.',
    'Treat unimplemented automation features as placeholders until they are built out.'
  ].join('\n');

  const output = {
    systemMessage: `Blueprint scaffold loaded (${source}).`,
    hookSpecificOutput: {
      additionalContext
    },
    suppressOutput: false
  };

  process.stdout.write(JSON.stringify(output));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
