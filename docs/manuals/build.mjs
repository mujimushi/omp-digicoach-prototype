// Builds the admin and doctor manuals as A4 PDFs from admin.html and doctor.html.
//   node docs/manuals/build.mjs [output folder]
// Take the screenshots first with capture.mjs.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.argv[2] ?? `${here}/dist`);
mkdirSync(out, { recursive: true });

const manuals = [
  { page: 'admin.html', file: 'OMP DigiCoach - Admin Guide.pdf', title: 'Admin Guide' },
  { page: 'doctor.html', file: 'OMP DigiCoach - Doctor Guide.pdf', title: 'Doctor Guide' },
];

const footer = (title) => `
  <div style="width:100%;font-size:8px;color:#8a7fa3;padding:0 16mm;display:flex;justify-content:space-between;font-family:'Segoe UI',Arial,sans-serif">
    <span>OMP DigiCoach · ${title}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

const browser = await chromium.launch();
for (const manual of manuals) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(here, manual.page)).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const path = resolve(out, manual.file);
  await page.pdf({
    path,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer(manual.title),
    outline: true,
    tagged: true,
  });
  await page.close();
  console.log('built', path);
}
await browser.close();
