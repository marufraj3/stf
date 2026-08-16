import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, '..');
const distDirectory = resolve(frontendDirectory, 'dist');
const publicDirectory = resolve(frontendDirectory, '../backend/public');
const distIndex = resolve(distDirectory, 'index.html');
const distAssets = resolve(distDirectory, 'assets');
const publicIndex = resolve(publicDirectory, 'index.html');
const publicAssets = resolve(publicDirectory, 'assets');

if (!existsSync(distIndex) || !existsSync(distAssets)) {
  throw new Error('Frontend dist is incomplete. Run npm run build first.');
}

mkdirSync(publicDirectory, { recursive: true });
rmSync(publicAssets, { recursive: true, force: true });
cpSync(distAssets, publicAssets, { recursive: true });
copyFileSync(distIndex, publicIndex);

const indexContents = readFileSync(publicIndex, 'utf8');
const referencedAssets = [...indexContents.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
  .map(match => match[1]);

if (!referencedAssets.length) {
  throw new Error('Built index.html does not reference any production assets.');
}

for (const asset of referencedAssets) {
  const assetPath = resolve(publicDirectory, `.${asset}`);
  if (!existsSync(assetPath)) {
    throw new Error(`Missing built asset: ${asset}`);
  }
}

writeFileSync(
  resolve(publicDirectory, '.frontend-build.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), assets: referencedAssets }, null, 2)}\n`,
);

console.log(`Synced ${referencedAssets.length} frontend assets to Laravel public/.`);
