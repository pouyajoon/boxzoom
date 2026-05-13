import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const docsDir = join(projectRoot, 'docs');
const previewRoot = join(projectRoot, '.preview-github-pages');
const siteDir = join(previewRoot, 'boxzoom');
const port = process.env.PORT ?? '4173';

if (!existsSync(docsDir)) {
  console.error('Missing docs/. Run: pnpm run build:github-pages');
  process.exit(1);
}

rmSync(previewRoot, { force: true, recursive: true });
mkdirSync(siteDir, { recursive: true });
cpSync(docsDir, siteDir, { recursive: true });

console.log('');
console.log('Preview matches GitHub project Pages (base path /boxzoom/):');
console.log(`  http://localhost:${port}/boxzoom/`);
console.log('');

const child = spawn('npx', ['--yes', 'serve@14', previewRoot, '-l', port], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
