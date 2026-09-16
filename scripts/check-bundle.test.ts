import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBundle } from './check-bundle.ts';

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function fakeDist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'omp-dist-'));
  made.push(dir);
  mkdirSync(join(dir, 'assets'));
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(dir, name), content);
  return dir;
}

const html =
  '<script type="module" crossorigin src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-abc.css">';

describe('checkBundle', () => {
  it('passes a small build with a separate, lazily loaded admin chunk', () => {
    const dist = fakeDist({
      'index.html': html,
      'assets/index-abc.js':
        'const a=()=>import("./admin-xyz.js");console.log(a)',
      'assets/index-abc.css': 'body{margin:0}',
      'assets/admin-xyz.js': 'export const admin=1',
    });
    expect(checkBundle(dist).problems).toEqual([]);
  });

  it('fails when the doctor entry is over budget', () => {
    const random = Array.from(
      { length: 4000 },
      (_, i) => `${i * 7919}${Math.sin(i)}`,
    ).join(',');
    const dist = fakeDist({
      'index.html': html,
      'assets/index-abc.js': random,
      'assets/index-abc.css': '',
      'assets/admin-xyz.js': '',
    });
    const report = checkBundle(dist, 10 * 1024);
    expect(report.problems.join('\n')).toMatch(/over the 10 KB budget/);
  });

  it('fails when msw or the memory repository appears', () => {
    const dist = fakeDist({
      'index.html': html,
      'assets/index-abc.js': 'console.log("[MSW] Mocking enabled.")',
      'assets/index-abc.css': '',
      'assets/admin-xyz.js': 'function createMemoryRepository(){}',
    });
    const problems = checkBundle(dist).problems.join('\n');
    expect(problems).toMatch(
      /Mock code \(\/\\\[MSW\\\]\/\) found in assets\/index-abc\.js/,
    );
    expect(problems).toMatch(
      /createMemoryRepository\/\) found in assets\/admin-xyz\.js/,
    );
  });

  it('fails without an admin chunk, or when the entry imports it statically', () => {
    const missing = fakeDist({
      'index.html': html,
      'assets/index-abc.js': '',
      'assets/index-abc.css': '',
    });
    expect(checkBundle(missing).problems).toContain(
      'No admin chunk (assets/admin-*.js) was built',
    );

    const eager = fakeDist({
      'index.html': html,
      'assets/index-abc.js': 'import{a}from"./admin-xyz.js";console.log(a)',
      'assets/index-abc.css': '',
      'assets/admin-xyz.js': 'export const a=1',
    });
    expect(checkBundle(eager).problems.join('\n')).toMatch(
      /statically imports the admin chunk/,
    );
  });
});
