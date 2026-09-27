// Checks the built app: the doctor entry stays under its size budget, the dashboard builds as its own
// chunk that the doctor entry doesn't load, and no mock code reaches the build.
//
//   node scripts/check-bundle.ts [app/dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const DOCTOR_BUDGET_BYTES = 250 * 1024;

/** Text that only mock code contains: MSW's own markers and the memory repository's. */
export const MOCK_MARKERS = [
  /\[MSW\]/,
  /mockServiceWorker/,
  /msw\//,
  /createMemoryRepository/,
  /memory-repository/,
  /That pearl belongs to another doctor/,
];

export type BundleReport = {
  problems: string[];
  doctorGzipBytes: number;
  adminChunk: string | null;
};

/** A path inside the build, with forward slashes on every system. */
function inDist(distDir: string, file: string): string {
  return relative(distDir, file).split(sep).join('/');
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function checkBundle(
  distDir: string,
  budgetBytes = DOCTOR_BUDGET_BYTES,
): BundleReport {
  const problems: string[] = [];
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');

  // The doctor entry is everything index.html loads at once: the entry script, preloaded chunks and CSS.
  const loaded = [
    ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/([^"]+\.css)"/g),
  ].map((match) => match[1] ?? '');
  if (!loaded.some((file) => file.endsWith('.js')))
    problems.push('index.html loads no script');

  let doctorGzipBytes = 0;
  for (const file of loaded) {
    const content = readFileSync(join(distDir, file));
    doctorGzipBytes += gzipSync(content).length;
    if (
      file.endsWith('.js') &&
      /(?:^|[;\s])import\s*(?:[^(;]*?from\s*)?["']\.\/admin-[^"']+\.js["']/m.test(
        content.toString('utf8'),
      )
    ) {
      problems.push(
        `The doctor entry ${file} statically imports the admin chunk`,
      );
    }
  }
  if (doctorGzipBytes > budgetBytes) {
    problems.push(
      `The doctor entry is ${(doctorGzipBytes / 1024).toFixed(1)} KB gzipped, over the ${(budgetBytes / 1024).toFixed(0)} KB budget`,
    );
  }
  if (/admin-[A-Za-z0-9_-]+\.js/.test(html))
    problems.push('index.html loads the admin chunk');

  const files = listFiles(distDir);
  const adminChunk =
    files
      .map((f) => inDist(distDir, f))
      .find((f) => /^assets\/admin-[A-Za-z0-9_-]+\.js$/.test(f)) ?? null;
  if (!adminChunk)
    problems.push('No admin chunk (assets/admin-*.js) was built');

  for (const file of files) {
    if (!/\.(js|html|css|webmanifest)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const marker of MOCK_MARKERS) {
      if (marker.test(text))
        problems.push(
          `Mock code (${marker}) found in ${inDist(distDir, file)}`,
        );
    }
  }

  return { problems, doctorGzipBytes, adminChunk };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const distDir = process.argv[2] ?? 'app/dist';
  const report = checkBundle(distDir);
  console.log(
    `Doctor entry: ${(report.doctorGzipBytes / 1024).toFixed(1)} KB gzipped (budget ${DOCTOR_BUDGET_BYTES / 1024} KB)`,
  );
  console.log(`Admin chunk: ${report.adminChunk ?? 'missing'}`);
  if (report.problems.length > 0) {
    for (const problem of report.problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log('Bundle checks passed.');
}
