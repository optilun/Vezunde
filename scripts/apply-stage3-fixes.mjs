import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/workspace/provider/ProviderServicesWorkspace.jsx';
let content = await readFile(path, 'utf8');
const before = '  Wrench,\n';
if (!content.includes(before)) {
  throw new Error('Stage 3 cleanup anchor not found');
}
content = content.replace(before, '');
await writeFile(path, content);
