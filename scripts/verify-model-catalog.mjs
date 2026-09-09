import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, 'public', 'eve-3d-models.json'), 'utf8'));
const galleryRoot = 'E:/AI/Projects/EveOnlineCal/3d-models/EVE_Model_Gallery/docs';
const entries = Object.entries(catalog.models);
const paths = [...new Set(entries.map(([, model]) => model.path))].sort();
const pathUsage = new Map(paths.map((modelPath) => [modelPath, []]));
for (const [typeId, model] of entries) pathUsage.get(model.path).push(typeId);

const errors = [];
const extensionUsage = new Map();
const extensionCombinations = new Map();
let totalBytes = 0;

for (const modelPath of paths) {
  const absolutePath = path.resolve(galleryRoot, modelPath);
  if (!absolutePath.startsWith(path.resolve(galleryRoot) + path.sep)) {
    errors.push(`${modelPath}: path escapes gallery root`);
    continue;
  }

  let handle;
  try {
    handle = await fs.open(absolutePath, 'r');
    const stat = await handle.stat();
    totalBytes += stat.size;
    const header = Buffer.alloc(20);
    await handle.read(header, 0, header.length, 0);
    const magic = header.toString('ascii', 0, 4);
    const version = header.readUInt32LE(4);
    const declaredLength = header.readUInt32LE(8);
    const jsonLength = header.readUInt32LE(12);
    const jsonType = header.toString('ascii', 16, 20);
    if (magic !== 'glTF' || version !== 2 || declaredLength !== stat.size || jsonType !== 'JSON') {
      errors.push(`${modelPath}: invalid GLB header (${magic}, v${version}, ${declaredLength}/${stat.size}, ${jsonType})`);
      continue;
    }
    const jsonBytes = Buffer.alloc(jsonLength);
    await handle.read(jsonBytes, 0, jsonLength, 20);
    const gltf = JSON.parse(jsonBytes.toString('utf8'));
    const required = [...new Set(gltf.extensionsRequired ?? [])].sort();
    const combination = required.length ? required.join(' + ') : 'без обязательных расширений';
    extensionCombinations.set(combination, (extensionCombinations.get(combination) ?? 0) + 1);
    for (const extension of required) extensionUsage.set(extension, (extensionUsage.get(extension) ?? 0) + 1);

    let offset = 12;
    while (offset < stat.size) {
      const chunkHeader = Buffer.alloc(8);
      await handle.read(chunkHeader, 0, 8, offset);
      const chunkLength = chunkHeader.readUInt32LE(0);
      offset += 8 + chunkLength;
      if (offset > stat.size) throw new Error(`chunk exceeds file length at ${offset}`);
    }
    if (offset !== stat.size) throw new Error(`chunks end at ${offset}, file ends at ${stat.size}`);
  } catch (error) {
    errors.push(`${modelPath}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await handle?.close();
  }
}

console.log(`Catalog entries: ${entries.length}`);
console.log(`Unique model files: ${paths.length}`);
console.log(`Validated bytes: ${totalBytes}`);
console.log('Required extensions:');
for (const [name, count] of [...extensionUsage].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${name}: ${count}`);
console.log('Extension combinations:');
for (const [name, count] of [...extensionCombinations].sort((a, b) => b[1] - a[1])) console.log(`  ${count}: ${name}`);
if (errors.length) {
  console.error(`Errors: ${errors.length}`);
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
} else {
  console.log('Errors: 0');
}
