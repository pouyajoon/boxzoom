import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const distRoot = join(projectRoot, 'dist', 'boxzoom-ng');
const browserOutput = join(distRoot, 'browser');
const sourceDir = existsSync(browserOutput) ? browserOutput : distRoot;
const docsDir = join(projectRoot, 'docs');
const indexPath = join(docsDir, 'index.html');

if (!existsSync(sourceDir)) {
  throw new Error(`Angular build output not found at ${sourceDir}`);
}

rmSync(docsDir, { force: true, recursive: true });
mkdirSync(docsDir, { recursive: true });
cpSync(sourceDir, docsDir, { recursive: true });

if (!existsSync(indexPath)) {
  throw new Error(`Cannot create GitHub Pages fallback: ${indexPath} was not generated.`);
}

cpSync(indexPath, join(docsDir, '404.html'));
writeFileSync(join(docsDir, '.nojekyll'), '');

console.log('GitHub Pages files prepared in docs/.');
