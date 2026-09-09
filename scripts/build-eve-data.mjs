import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourceCandidates = [
  'E:/AI/Projects/EveOnlineCal',
  path.resolve(projectRoot, '..', 'outputs', '01a076f8-eve-resources'),
];
let resourceRoot;
for (const candidate of resourceCandidates) {
  try {
    await fs.access(path.join(candidate, 'source', 'blueprints.jsonl'));
    resourceRoot = candidate;
    break;
  } catch {
    // Try the next known location.
  }
}
if (!resourceRoot) throw new Error('EVE resource directory was not found.');
const sourceRoot = path.join(resourceRoot, 'source');
const publicRoot = path.join(projectRoot, 'public');
const iconOutput = path.join(publicRoot, 'eve-icons');
const eveInfoLegacyRecipes = JSON.parse(
  await fs.readFile(path.join(projectRoot, 'data', 'eveinfo-legacy-recipes.json'), 'utf8'),
);

async function readJsonl(fileName) {
  return readJsonlAt(sourceRoot, fileName);
}

async function readJsonlAt(root, fileName) {
  const text = await fs.readFile(path.join(root, fileName), 'utf8');
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const [
  typesRows,
  groupsRows,
  categoriesRows,
  blueprintRows,
  planetSchematicsRows,
  typeMaterialsRows,
  typeDogmaRows,
  dogmaAttributeRows,
  dogmaUnitRows,
  dogmaAttributeCategoryRows,
] = await Promise.all([
  readJsonl('types.jsonl'),
  readJsonl('groups.jsonl'),
  readJsonl('categories.jsonl'),
  readJsonl('blueprints.jsonl'),
  readJsonl('planetSchematics.jsonl'),
  readJsonl('typeMaterials.jsonl'),
  readJsonl('typeDogma.jsonl'),
  readJsonl('dogmaAttributes.jsonl'),
  readJsonlAt(path.join(projectRoot, 'data', 'sde'), 'dogmaUnits.jsonl'),
  readJsonlAt(path.join(projectRoot, 'data', 'sde'), 'dogmaAttributeCategories.jsonl'),
]);
const oreSource = JSON.parse(await fs.readFile(path.join(resourceRoot, 'ores-data.json'), 'utf8'));

const typeById = new Map(typesRows.map((item) => [Number(item.typeID ?? item._key), item]));
const groupById = new Map(groupsRows.map((item) => [Number(item.groupID ?? item._key), item]));
const categoryById = new Map(categoriesRows.map((item) => [Number(item.categoryID ?? item._key), item]));
const typeMaterialsById = new Map(typeMaterialsRows.map((item) => [Number(item._key ?? item.typeID), item]));
const typeDogmaById = new Map(typeDogmaRows.map((item) => [Number(item._key ?? item.typeID), item]));
const dogmaAttributeById = new Map(dogmaAttributeRows.map((item) => [Number(item._key), item]));
const dogmaUnitById = new Map(dogmaUnitRows.map((item) => [Number(item._key), item]));
const dogmaAttributeCategoryById = new Map(dogmaAttributeCategoryRows.map((item) => [Number(item._key), item]));

function englishName(record, fallback) {
  return record?.name?.en || record?.name?.ru || fallback;
}

function plainDescription(record) {
  const value = record?.description?.ru || record?.description?.en || '';
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(?:p|div|li|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const iceTypes = typesRows.filter((type) => {
  const name = englishName(type, '');
  const id = Number(type._key ?? type.typeID);
  return Number(type.groupID) === 465
    && type.published === true
    && Boolean(type.marketGroupID)
    && typeMaterialsById.has(id)
    && !name.startsWith('Compressed ');
});
const iceProductIds = new Set(
  iceTypes.flatMap((type) =>
    (typeMaterialsById.get(Number(type._key ?? type.typeID))?.materials ?? [])
      .map((material) => Number(material.materialTypeID)),
  ),
);
const materialIds = new Set([...Object.keys(oreSource.material_names).map(Number), ...iceProductIds]);

function materialName(id) {
  return oreSource.material_names[String(id)] || englishName(typeById.get(id), `Type ${id}`);
}

const legacyRecipeOverrides = new Map(
  eveInfoLegacyRecipes.recipes.map((recipe) => [recipe.blueprintId, recipe]),
);

function blueprintMaterial(materialId, quantity) {
  const materialType = typeById.get(materialId);
  if (!materialType || materialType.published === false) return null;
  const group = groupById.get(Number(materialType.groupID));
  const category = categoryById.get(Number(group?.categoryID));
  return {
    id: materialId,
    name: englishName(materialType, `Type ${materialId}`),
    quantity: Number(quantity),
    group: englishName(group, 'Other'),
    groupRu: group?.name?.ru || englishName(group, 'Прочее'),
    category: englishName(category, 'Other'),
    categoryRu: category?.name?.ru || englishName(category, 'Прочее'),
  };
}

function blueprintSkill(skillId, level) {
  const skillType = typeById.get(skillId);
  if (!skillType || skillType.published === false || !level || level < 1) return null;
  return {
    id: skillId,
    name: englishName(skillType, `Type ${skillId}`),
    level: Number(level),
  };
}

const blueprints = [];
for (const blueprint of blueprintRows) {
  const blueprintId = Number(blueprint.blueprintTypeID ?? blueprint._key);
  const blueprintType = typeById.get(blueprintId);
  if (blueprintType?.published === false) continue;

  for (const activityName of ['manufacturing', 'reaction']) {
    const activity = blueprint.activities?.[activityName];
    if (!activity?.materials?.length || !activity?.products?.length) continue;
    const products = activity.products
      .map((product) => {
        const productId = Number(product.typeID);
        const productType = typeById.get(productId);
        if (!productType || productType.published === false) return null;
        const group = groupById.get(Number(productType.groupID));
        const category = categoryById.get(Number(group?.categoryID));
        return {
          id: productId,
          name: englishName(productType, `Type ${productId}`),
          quantity: Number(product.quantity ?? 1),
          group: englishName(group, 'Other'),
          groupRu: group?.name?.ru || englishName(group, 'Прочее'),
          category: englishName(category, 'Other'),
          categoryRu: category?.name?.ru || englishName(category, 'Прочее'),
        };
      })
      .filter(Boolean);
    if (!products.length) continue;

    const materials = activity.materials
      .map((material) => blueprintMaterial(Number(material.typeID), material.quantity))
      .filter(Boolean);
    if (!materials.length) continue;

    const productIds = new Set(products.map((product) => product.id));
    const hasSelfReferentialRecipe = materials.length > 0
      && materials.every((material) => productIds.has(material.id));
    const legacyOverride = hasSelfReferentialRecipe ? legacyRecipeOverrides.get(blueprintId) : null;
    const resolvedMaterials = legacyOverride
      ? legacyOverride.materials.map((material) => blueprintMaterial(material.id, material.quantity)).filter(Boolean)
      : hasSelfReferentialRecipe ? [] : materials;

    blueprints.push({
      id: blueprintId,
      name: englishName(blueprintType, `Blueprint ${blueprintId}`),
      description: plainDescription(typeById.get(products[0].id)) || plainDescription(blueprintType),
      recipeStatus: legacyOverride ? 'legacy' : hasSelfReferentialRecipe ? 'unavailable' : 'available',
      recipeNote: legacyOverride
        ? 'Текущий EVE SDE заменил состав самоссылкой. Здесь показан архивный состав EveInfo: базовые и дополнительные материалы объединены в итоговое количество.'
        : hasSelfReferentialRecipe
          ? 'В текущих данных EVE SDE этот чертёж содержит только самоссылку: производимый предмет указан одновременно как единственный материал и результат. Действующий состав производства отсутствует.'
          : '',
      recipeSource: legacyOverride?.sourceUrl || '',
      activity: activityName === 'reaction' ? 'reaction' : 'manufacturing',
      time: Number(activity.time ?? 0),
      skills: (activity.skills ?? [])
        .map((skill) => blueprintSkill(Number(skill.typeID), Number(skill.level)))
        .filter(Boolean),
      materials: resolvedMaterials,
      products,
    });
  }
}

blueprints.sort((a, b) => {
  const aName = a.products[0]?.name || a.name;
  const bName = b.products[0]?.name || b.name;
  return aName.localeCompare(bName, 'en') || a.id - b.id;
});

const blueprintUse = new Map([...materialIds].map((id) => [id, []]));
for (const blueprint of blueprints) {
  for (const material of blueprint.materials) {
    if (!materialIds.has(material.id)) continue;
    blueprintUse.get(material.id).push({
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      description: blueprint.description,
      activity: blueprint.activity,
      materialQuantity: material.quantity,
      time: blueprint.time,
      products: blueprint.products,
    });
  }
}

const minerals = [...materialIds]
  .map((id) => ({
    id,
    name: materialName(id),
    blueprints: blueprintUse.get(id).sort((a, b) => {
      const aName = a.products[0]?.name || a.blueprintName;
      const bName = b.products[0]?.name || b.blueprintName;
      return aName.localeCompare(bName, 'en');
    }),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const asteroidAndMoonOres = oreSource.ores
  .map((ore) => {
    const fixed = (ore.materials || []).map((material) => ({
      id: Number(material.materialTypeID),
      name: materialName(Number(material.materialTypeID)),
      quantity: Number(material.quantity),
      minimum: null,
      maximum: null,
      random: false,
    }));
    const random = (ore.randomized || []).map((material) => ({
      id: Number(material.materialTypeID),
      name: materialName(Number(material.materialTypeID)),
      quantity: null,
      minimum: Number(material.minimumQuantity ?? material.minQuantity ?? material.minimum ?? 0),
      maximum: Number(material.maximumQuantity ?? material.maxQuantity ?? material.maximum ?? 0),
      random: true,
    }));
    return {
      id: Number(ore.id),
      name: ore.name,
      family: ore.family,
      kind: ore.kind,
      grade: ore.grade,
      volume: Number(ore.volume),
      portion: Number(ore.portion),
      minerals: [...fixed, ...random],
    };
  });

const iceOres = iceTypes.map((type) => {
  const id = Number(type._key ?? type.typeID);
  const name = englishName(type, `Type ${id}`);
  const materials = typeMaterialsById.get(id)?.materials ?? [];
  return {
    id,
    name,
    family: name.replace(/ IV-Grade$/, ''),
    kind: 'Лёд',
    grade: name.endsWith(' IV-Grade') ? 'IV-Grade' : 'Базовая',
    volume: Number(type.volume ?? 0),
    portion: Number(type.portionSize ?? 1),
    minerals: materials.map((material) => ({
      id: Number(material.materialTypeID),
      name: materialName(Number(material.materialTypeID)),
      quantity: Number(material.quantity),
      minimum: null,
      maximum: null,
      random: false,
    })),
  };
});

const ores = [...asteroidAndMoonOres, ...iceOres]
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const planetaryTierByGroupId = new Map([
  [1032, 'P0'],
  [1033, 'P0'],
  [1035, 'P0'],
  [1042, 'P1'],
  [1034, 'P2'],
  [1040, 'P3'],
  [1041, 'P4'],
]);

const planetDefinitions = [
  { id: 'barren', typeId: 2016, name: 'Бесплодная', nameEn: 'Barren' },
  { id: 'gas', typeId: 13, name: 'Газовая', nameEn: 'Gas' },
  { id: 'ice', typeId: 12, name: 'Ледяная', nameEn: 'Ice' },
  { id: 'lava', typeId: 2015, name: 'Лавовая', nameEn: 'Lava' },
  { id: 'oceanic', typeId: 2014, name: 'Океаническая', nameEn: 'Oceanic' },
  { id: 'plasma', typeId: 2063, name: 'Плазменная', nameEn: 'Plasma' },
  { id: 'storm', typeId: 2017, name: 'Штормовая', nameEn: 'Storm' },
  { id: 'temperate', typeId: 11, name: 'Умеренная', nameEn: 'Temperate' },
];

// Planet availability reproduced from the matrix on eve-space.ru.
const planetsByRawTypeId = new Map([
  [2268, ['barren', 'gas', 'ice', 'oceanic', 'storm', 'temperate']],
  [2305, ['temperate']],
  [2267, ['barren', 'gas', 'lava', 'plasma', 'storm']],
  [2288, ['barren', 'oceanic', 'temperate']],
  [2287, ['oceanic', 'temperate']],
  [2307, ['lava']],
  [2272, ['ice', 'lava', 'plasma']],
  [2309, ['gas', 'storm']],
  [2073, ['barren', 'ice', 'oceanic', 'temperate']],
  [2310, ['gas', 'storm']],
  [2270, ['barren', 'plasma']],
  [2306, ['lava', 'plasma']],
  [2286, ['ice', 'oceanic']],
  [2311, ['gas']],
  [2308, ['lava', 'plasma', 'storm']],
]);

const planetaryRecipesByOutputId = new Map();
const planetaryTypeIds = new Set();
for (const schematic of planetSchematicsRows) {
  const outputEntry = schematic.types.find((item) => !item.isInput);
  if (!outputEntry) continue;
  const outputId = Number(outputEntry._key ?? outputEntry.typeID);
  const inputs = schematic.types
    .filter((item) => item.isInput)
    .map((item) => {
      const id = Number(item._key ?? item.typeID);
      const type = typeById.get(id);
      planetaryTypeIds.add(id);
      return {
        id,
        name: englishName(type, `Type ${id}`),
        quantity: Number(item.quantity),
      };
    });
  planetaryTypeIds.add(outputId);
  planetaryRecipesByOutputId.set(outputId, {
    id: Number(schematic._key ?? schematic.schematicID),
    name: schematic.name?.en || schematic.name?.ru || `Schematic ${schematic._key}`,
    cycleTime: Number(schematic.cycleTime ?? 0),
    outputQuantity: Number(outputEntry.quantity),
    inputs,
  });
}

const tierRank = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const planetaryCommodities = [...planetaryTypeIds]
  .map((id) => {
    const type = typeById.get(id);
    const tier = planetaryTierByGroupId.get(Number(type?.groupID));
    if (!type || !tier) return null;
    return {
      id,
      name: englishName(type, `Type ${id}`),
      tier,
      volume: Number(type.volume ?? 0),
      planets: planetsByRawTypeId.get(id) ?? [],
      recipe: planetaryRecipesByOutputId.get(id) ?? null,
    };
  })
  .filter(Boolean)
  .sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || a.name.localeCompare(b.name, 'en'));

const planetary = {
  sourceUrl: 'http://eve-space.ru/planetology/planetary_interaction.html',
  planets: planetDefinitions.map((planet) => ({
    ...planet,
    resources: planetaryCommodities
      .filter((commodity) => commodity.tier === 'P0' && commodity.planets.includes(planet.id))
      .map((commodity) => commodity.id),
  })),
  commodities: planetaryCommodities,
};

const planetaryCommodityById = new Map(planetaryCommodities.map((commodity) => [commodity.id, commodity]));
const planetaryBlueprints = planetaryCommodities
  .filter((commodity) => commodity.recipe)
  .map((commodity) => ({
    id: -commodity.recipe.id,
    name: `${commodity.name} Schematic`,
    description: `Планетарная производственная схема ${commodity.tier}: ${commodity.recipe.inputs.map((input) => `${input.name} × ${input.quantity}`).join(' + ')} → ${commodity.name} × ${commodity.recipe.outputQuantity}.`,
    recipeStatus: 'available',
    recipeNote: '',
    recipeSource: '',
    activity: 'manufacturing',
    time: commodity.recipe.cycleTime,
    skills: [],
    materials: commodity.recipe.inputs.map((input) => {
      const inputCommodity = planetaryCommodityById.get(input.id);
      return {
        id: input.id,
        name: input.name,
        quantity: input.quantity,
        group: inputCommodity ? `${inputCommodity.tier} Planetary Commodity` : 'Planetary Commodity',
        groupRu: inputCommodity ? `Планетарные материалы ${inputCommodity.tier}` : 'Планетарные материалы',
        category: 'Planetary',
        categoryRu: 'Планетарное производство',
      };
    }),
    products: [{
      id: commodity.id,
      name: commodity.name,
      quantity: commodity.recipe.outputQuantity,
      group: `${commodity.tier} Planetary Commodity`,
      groupRu: `Планетарные материалы ${commodity.tier}`,
      category: 'Planetary',
      categoryRu: 'Планетарное производство',
    }],
  }));

blueprints.push(...planetaryBlueprints);
blueprints.sort((a, b) => {
  const aName = a.products[0]?.name || a.name;
  const bName = b.products[0]?.name || b.name;
  return aName.localeCompare(bName, 'en') || a.id - b.id;
});

const requiredSkillAttributePairs = [
  [182, 277],
  [183, 278],
  [184, 279],
  [1285, 1286],
  [1289, 1287],
  [1290, 1288],
];
const characterAttributeNamesRu = new Map([
  [164, 'Харизма'],
  [165, 'Интеллект'],
  [166, 'Память'],
  [167, 'Восприятие'],
  [168, 'Сила воли'],
]);

function dogmaAttributeValue(dogma, attributeId) {
  const value = dogma?.dogmaAttributes?.find((item) => Number(item.attributeID) === attributeId)?.value;
  return value === undefined ? null : Number(value);
}

const skills = typesRows
  .filter((type) => {
    const group = groupById.get(Number(type.groupID));
    return type.published === true && Number(group?.categoryID) === 16;
  })
  .map((type) => {
    const id = Number(type._key ?? type.typeID);
    const group = groupById.get(Number(type.groupID));
    const dogma = typeDogmaById.get(id);
    const requirements = requiredSkillAttributePairs.flatMap(([skillAttributeId, levelAttributeId]) => {
      const skillId = dogmaAttributeValue(dogma, skillAttributeId);
      const level = dogmaAttributeValue(dogma, levelAttributeId);
      const requiredType = skillId === null ? null : typeById.get(skillId);
      if (!requiredType || !level || level < 1) return [];
      return [{
        id: skillId,
        name: englishName(requiredType, `Type ${skillId}`),
        level,
      }];
    });
    const primaryAttributeId = dogmaAttributeValue(dogma, 180);
    const secondaryAttributeId = dogmaAttributeValue(dogma, 181);
    return {
      id,
      name: englishName(type, `Type ${id}`),
      description: plainDescription(type),
      groupId: Number(type.groupID),
      group: group?.name?.en || group?.name?.ru || 'Other Skills',
      groupRu: group?.name?.ru || group?.name?.en || 'Другие навыки',
      rank: dogmaAttributeValue(dogma, 275) ?? 1,
      primaryAttribute: characterAttributeNamesRu.get(primaryAttributeId) || 'Не указана',
      secondaryAttribute: characterAttributeNamesRu.get(secondaryAttributeId) || 'Не указана',
      requirements,
    };
  })
  .sort((left, right) =>
    left.groupRu.localeCompare(right.groupRu, 'ru')
    || left.name.localeCompare(right.name, 'en')
    || left.id - right.id,
  );

const characteristicCategoryNamesRu = new Map([
  [1, 'Оснащение'],
  [2, 'Щиты'],
  [3, 'Броня'],
  [4, 'Корпус'],
  [5, 'Накопитель'],
  [6, 'Захват целей'],
  [7, 'Прочее'],
  [10, 'Дроны'],
  [17, 'Скорость и перемещение'],
  [20, 'Дистанционная помощь'],
  [29, 'Турели'],
  [30, 'Ракеты'],
  [34, 'Способности истребителей'],
  [36, 'Сопротивление электронным воздействиям'],
  [37, 'Бонусы'],
  [38, 'Характеристики истребителей'],
  [39, 'Супероружие'],
  [40, 'Ангары и отсеки'],
  [51, 'Добыча'],
  [52, 'Перегрев'],
]);
const ignoredCharacteristicUnitIds = new Set([115, 116, 119, 137, 142, 143]);
const ignoredCharacteristicNames = new Set(['damage', 'powerLoad', 'cpuLoad', 'techLevel', 'metaLevelOld']);

function productCharacteristics(typeId) {
  const type = typeById.get(typeId);
  if (!type) return null;

  const basics = [
    ['basePrice', 'Базовая цена', type.basePrice, 'ISK'],
    ['volume', 'Объём', type.volume, 'м³'],
    ['packagedVolume', 'Объём в упаковке', type.packagedVolume, 'м³'],
    ['mass', 'Масса', type.mass, 'кг'],
    ['capacity', 'Вместимость', type.capacity, 'м³'],
    ['radius', 'Радиус', type.radius, 'м'],
    ['portionSize', 'Размер партии', type.portionSize, 'ед.'],
    ['techLevel', 'Технологический уровень', type.techLevel, ''],
    ['metaLevel', 'Метауровень', type.metaLevel, ''],
  ]
    .filter(([, , value]) => value !== undefined && value !== null && Number.isFinite(Number(value)))
    .map(([id, name, value, unit]) => ({ id, name, value: Number(value), unitId: null, unit }));

  const grouped = new Map();
  const seenLabels = new Set();
  const dogma = typeDogmaById.get(typeId);
  for (const item of dogma?.dogmaAttributes ?? []) {
    const definition = dogmaAttributeById.get(Number(item.attributeID));
    const value = Number(item.value);
    const categoryId = Number(definition?.attributeCategoryID);
    const unitId = definition?.unitID === undefined ? null : Number(definition.unitID);
    const label = definition?.displayName?.ru || definition?.displayName?.en;
    if (!definition?.published || !label || !characteristicCategoryNamesRu.has(categoryId)) continue;
    if (!Number.isFinite(value) || (value === 0 && !definition.displayWhenZero)) continue;
    if (ignoredCharacteristicNames.has(definition.name) || (unitId !== null && ignoredCharacteristicUnitIds.has(unitId))) continue;
    const labelKey = `${categoryId}:${label.toLocaleLowerCase('ru')}`;
    if (seenLabels.has(labelKey)) continue;
    seenLabels.add(labelKey);
    const unit = unitId === null ? null : dogmaUnitById.get(unitId);
    const attributes = grouped.get(categoryId) ?? [];
    attributes.push({
      id: Number(item.attributeID),
      name: label,
      value,
      unitId,
      unit: unit?.displayName?.ru || unit?.displayName?.en || '',
    });
    grouped.set(categoryId, attributes);
  }

  const groups = [];
  if (basics.length) groups.push({ id: 0, name: 'Основные параметры', attributes: basics });
  for (const [categoryId, name] of characteristicCategoryNamesRu) {
    const attributes = grouped.get(categoryId);
    if (attributes?.length) groups.push({
      id: categoryId,
      name: name || dogmaAttributeCategoryById.get(categoryId)?.name || `Группа ${categoryId}`,
      attributes,
    });
  }
  return { typeId, groups };
}

const characteristicBuckets = new Map();
const productTypeIds = new Set(blueprints.flatMap((blueprint) => blueprint.products.map((product) => product.id)));
for (const typeId of productTypeIds) {
  const characteristics = productCharacteristics(typeId);
  if (!characteristics) continue;
  const bucketId = typeId % 64;
  const bucket = characteristicBuckets.get(bucketId) ?? {};
  bucket[String(typeId)] = characteristics;
  characteristicBuckets.set(bucketId, bucket);
}

const characteristicsOutput = path.join(publicRoot, 'product-characteristics');
if (!characteristicsOutput.startsWith(`${publicRoot}${path.sep}`)) {
  throw new Error('Invalid product characteristics output path.');
}
await fs.rm(characteristicsOutput, { recursive: true, force: true });
await fs.mkdir(characteristicsOutput, { recursive: true });
await Promise.all(
  [...characteristicBuckets.entries()].map(([bucketId, bucket]) =>
    fs.writeFile(path.join(characteristicsOutput, `${bucketId}.json`), JSON.stringify(bucket)),
  ),
);

await fs.mkdir(iconOutput, { recursive: true });
const iconIds = new Set([...ores.map((ore) => ore.id), ...minerals.map((mineral) => mineral.id)]);
await Promise.all(
  [...iconIds].map(async (id) => {
    try {
      await fs.copyFile(path.join(resourceRoot, 'icons', `${id}.png`), path.join(iconOutput, `${id}.png`));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }),
);

const output = {
  meta: {
    sdeBuild: oreSource.sde.buildNumber,
    releaseDate: oreSource.sde.releaseDate,
    oreCount: ores.length,
    mineralCount: minerals.length,
    blueprintUseCount: minerals.reduce((sum, mineral) => sum + mineral.blueprints.length, 0),
    uniqueBlueprintActivities: blueprints.length,
    skillCount: skills.length,
  },
  ores,
  minerals,
  blueprints,
  planetary,
  skills,
};

await fs.writeFile(path.join(publicRoot, 'eve-production-data.json'), JSON.stringify(output));
console.log(JSON.stringify(output.meta));
