import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(
  root,
  'scripts/bridge-sources/listProviderMemberInvitations.entry.ts',
);
const temporaryOutputPath = path.join(
  root,
  '.tmp/listProviderMemberInvitations.entry.bundle.ts',
);
const deployedOutputPath = path.join(
  root,
  'base44/functions/listProviderMemberInvitations/entry.ts',
);

await mkdir(path.dirname(temporaryOutputPath), { recursive: true });
await build({
  entryPoints: [sourcePath],
  outfile: temporaryOutputPath,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['npm:*'],
  banner: {
    js: '// Bundled single-file Base44 function. Do not add local project imports.',
  },
  logLevel: 'silent',
});

const bundledSource = await readFile(temporaryOutputPath, 'utf8');
if (/from ['"]\.\.?\//.test(bundledSource)) {
  throw new Error('Bundle-ul directory import contine importuri locale.');
}
if (!bundledSource.includes('viasee-directory-import-single-file-6')) {
  throw new Error('Bundle-ul directory import nu contine revizia asteptata.');
}

await writeFile(deployedOutputPath, bundledSource, 'utf8');
console.log(JSON.stringify({
  source: path.relative(root, sourcePath),
  bundle: path.relative(root, deployedOutputPath),
  bytes: Buffer.byteLength(bundledSource),
}, null, 2));
