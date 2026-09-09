import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionData = JSON.parse(await fs.readFile(path.join(projectRoot, 'public', 'eve-production-data.json'), 'utf8'));
const outputPath = path.join(projectRoot, 'data', 'eveinfo-legacy-recipes.json');

const candidates = productionData.blueprints.filter((blueprint) =>
  blueprint.recipeStatus === 'legacy' || blueprint.recipeStatus === 'unavailable',
);

function plainText(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseManufacturingMaterials(html) {
  const start = html.indexOf('>manufacturing</li>');
  if (start < 0) return [];
  const end = html.indexOf('</ul>', start);
  if (end < 0) return [];

  const section = html.slice(start, end);
  const materials = new Map();
  let phase = 'base';
  const rowPattern = /<li class="list-group-item(?: active sub| clearfix)">([\s\S]*?)<\/li>/gi;

  for (const match of section.matchAll(rowPattern)) {
    const row = match[1];
    if (/base materials/i.test(row)) {
      phase = 'base';
      continue;
    }
    if (/extra materials and skills/i.test(row)) {
      phase = 'extra';
      continue;
    }

    const idMatch = row.match(/href="\/item\/(\d+)\//i);
    const quantityMatch = row.match(/<span class="pull-right">\s*([\d\s.,]+)\s*<\/span>/i);
    const nameMatch = row.match(/<p>\s*([^<]+?)\s*<a/i);
    if (!idMatch || !quantityMatch || !nameMatch) continue;

    const id = Number(idMatch[1]);
    const quantity = Number(quantityMatch[1].replace(/[^\d]/g, ''));
    if (!Number.isFinite(id) || !Number.isFinite(quantity) || quantity <= 0) continue;

    const current = materials.get(id) ?? {
      id,
      name: plainText(nameMatch[1]),
      baseQuantity: 0,
      extraQuantity: 0,
      quantity: 0,
    };
    if (phase === 'extra') current.extraQuantity += quantity;
    else current.baseQuantity += quantity;
    current.quantity += quantity;
    materials.set(id, current);
  }

  return [...materials.values()];
}

const recipes = [];
const missing = [];
for (const blueprint of candidates) {
  const product = blueprint.products[0];
  const requestUrl = `https://eveinfo.com/item/${product.id}/`;
  try {
    const response = await fetch(requestUrl, {
      headers: { 'user-agent': 'EVE Production Tree recipe indexer/1.0' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const materials = parseManufacturingMaterials(html)
      .filter((material) => material.id !== product.id);
    if (!materials.length) throw new Error('manufacturing materials not found');
    recipes.push({
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      productId: product.id,
      productName: product.name,
      sourceUrl: response.url,
      materials,
    });
  } catch (error) {
    missing.push({
      blueprintId: blueprint.id,
      productId: product.id,
      productName: product.name,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

recipes.sort((left, right) => left.blueprintId - right.blueprintId);
missing.sort((left, right) => left.blueprintId - right.blueprintId);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify({ source: 'EveInfo', recipes, missing }, null, 2)}\n`);
console.log(JSON.stringify({ requested: candidates.length, found: recipes.length, missing }, null, 2));
