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
    await fs.access(path.join(candidate, 'source', 'typeDogma.jsonl'));
    resourceRoot = candidate;
    break;
  } catch {
    // Try the next known location.
  }
}
if (!resourceRoot) throw new Error('EVE resource directory was not found.');

const sourceRoot = path.join(resourceRoot, 'source');
const publicRoot = path.join(projectRoot, 'public');

async function readJsonl(fileName) {
  const text = await fs.readFile(path.join(sourceRoot, fileName), 'utf8');
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const [typesRows, groupsRows, categoriesRows, typeDogmaRows, dogmaAttributeRows, dogmaUnitRows, typeBonusRows, metaGroupRows, sdeRows] = await Promise.all([
  readJsonl('types.jsonl'),
  readJsonl('groups.jsonl'),
  readJsonl('categories.jsonl'),
  readJsonl('typeDogma.jsonl'),
  readJsonl('dogmaAttributes.jsonl'),
  readJsonl('dogmaUnits.jsonl'),
  readJsonl('typeBonus.jsonl'),
  readJsonl('metaGroups.jsonl'),
  readJsonl('_sde.jsonl'),
]);

const typeById = new Map(typesRows.map((item) => [Number(item._key ?? item.typeID), item]));
const groupById = new Map(groupsRows.map((item) => [Number(item._key ?? item.groupID), item]));
const categoryById = new Map(categoriesRows.map((item) => [Number(item._key ?? item.categoryID), item]));
const metaGroupById = new Map(metaGroupRows.map((item) => [Number(item._key), item]));
const dogmaById = new Map(typeDogmaRows.map((item) => [Number(item._key ?? item.typeID), item]));
const bonusById = new Map(typeBonusRows.map((item) => [Number(item._key), item]));
const attributeNameById = new Map(dogmaAttributeRows.map((item) => [Number(item._key), String(item.name)]));
const attributeById = new Map(dogmaAttributeRows.map((item) => [Number(item._key), item]));
const unitById = new Map(dogmaUnitRows.map((item) => [Number(item._key), item]));
const familiarMetaNamesRu = new Map([
  [1, 'Tech I'],
  [2, 'Tech II'],
  [3, 'Сюжетное'],
  [4, 'Фракционное'],
  [5, 'Офицерское'],
  [6, 'Дэдспейс'],
  [14, 'Tech III'],
  [15, 'Мутация Бездны'],
  [17, 'Эксклюзив'],
  [19, 'Ограниченное'],
  [52, 'Фракционное сооружение'],
  [53, 'Сооружение Tech II'],
  [54, 'Сооружение Tech I'],
]);

function localized(record, fallback = '') {
  return record?.ru || record?.en || fallback;
}

function english(record, fallback = '') {
  return record?.en || record?.ru || fallback;
}

function plainDescription(record) {
  return localized(record?.description, '')
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

function dogmaDetails(typeId) {
  const row = dogmaById.get(typeId);
  const values = {};
  for (const attribute of row?.dogmaAttributes ?? []) {
    const name = attributeNameById.get(Number(attribute.attributeID));
    if (name) values[name] = Number(attribute.value ?? 0);
  }
  return {
    values,
    effects: new Set((row?.dogmaEffects ?? []).map((effect) => Number(effect.effectID))),
  };
}

const excludedEffectCategories = new Set([8, 9, 12, 19, 31, 32, 33, 41, 42]);
const excludedEffectNames = new Set([
  'hp', 'cpu', 'power', 'techLevel', 'metaLevelOld', 'upgradeCost', 'rigSize',
  'chargeSize', 'droneBandwidthUsed', 'maxGroupFitted', 'maxTypeFitted',
  'subSystemSlot', 'capacity', 'mass', 'radius', 'volume',
]);
const excludedEffectUnitIds = new Set([115, 116, 119]);
const excludedEffectNamePattern = /^(?:requiredSkill|moduleShipGroup|canFitShipGroup|canFitShipType|chargeGroup|hiSlots|medSlots|lowSlots|rigSlots|serviceSlots|maxSubSystems|online|published)/;
const effectCategoryOrder = new Map([
  [51, 0], // Mining
  [37, 1], // Bonuses
  [29, 2], // Turrets
  [30, 3], // Missiles
  [20, 4], // Remote assistance
  [2, 5], [3, 6], [4, 7], [5, 8], [6, 9], [7, 10], [10, 11], [17, 12],
  [21, 13], [22, 14], [23, 15], [24, 16], [25, 17], [26, 18], [27, 19], [28, 20],
  [34, 21], [36, 22], [38, 23], [39, 24], [52, 25], [1, 26],
]);

function displayDogmaEffects(typeId) {
  const row = dogmaById.get(typeId);
  const result = [];
  for (const entry of row?.dogmaAttributes ?? []) {
    const attributeId = Number(entry.attributeID);
    const attribute = attributeById.get(attributeId);
    const value = Number(entry.value ?? 0);
    const categoryId = Number(attribute?.attributeCategoryID ?? 0);
    const name = String(attribute?.name ?? '');
    if (!attribute || attribute.published !== true || !attribute.displayName) continue;
    if (!Number.isFinite(value) || (value === 0 && attribute.displayWhenZero !== true)) continue;
    if (excludedEffectCategories.has(categoryId) || excludedEffectNames.has(name) || excludedEffectNamePattern.test(name)) continue;
    if (!effectCategoryOrder.has(categoryId)) continue;
    const unitId = Number(attribute.unitID ?? 0);
    if (excludedEffectUnitIds.has(unitId)) continue;
    const unit = unitById.get(unitId);
    result.push({
      attributeId,
      name,
      label: localized(attribute.displayName, name),
      value,
      unitId,
      unit: localized(unit?.displayName, ''),
      highIsGood: typeof attribute.highIsGood === 'boolean' ? attribute.highIsGood : null,
      order: effectCategoryOrder.get(categoryId) ?? 99,
    });
  }
  return result
    .sort((a, b) => a.order - b.order || a.attributeId - b.attributeId)
    .slice(0, 10)
    .map(({ order, ...effect }) => effect);
}

function positiveInteger(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function slotFor(effects) {
  if (effects.has(11)) return 'low';
  if (effects.has(13)) return 'mid';
  if (effects.has(12)) return 'high';
  if (effects.has(2663)) return 'rig';
  if (effects.has(3772)) return 'subsystem';
  if (effects.has(6306)) return 'service';
  return null;
}

function matchingValues(values, expression) {
  return Object.entries(values)
    .filter(([name, value]) => expression.test(name) && Number(value) > 0)
    .map(([, value]) => Number(value));
}

function skillRequirements(values) {
  const result = [];
  for (let index = 1; index <= 6; index += 1) {
    const id = Number(values[`requiredSkill${index}`] ?? 0);
    const level = Number(values[`requiredSkill${index}Level`] ?? 0);
    const skill = typeById.get(id);
    if (!id || !level || !skill) continue;
    result.push({ id, name: english(skill.name, `Type ${id}`), level });
  }
  return result;
}

function groupInfo(type) {
  const groupId = Number(type.groupID);
  const group = groupById.get(groupId);
  const categoryId = Number(group?.categoryID);
  const category = categoryById.get(categoryId);
  return {
    groupId,
    group: english(group?.name, `Group ${groupId}`),
    groupRu: localized(group?.name, english(group?.name, `Группа ${groupId}`)),
    categoryId,
    category: english(category?.name, `Category ${categoryId}`),
    categoryRu: localized(category?.name, english(category?.name, `Категория ${categoryId}`)),
  };
}

function metaInfo(type) {
  const metaGroupId = Number(type.metaGroupID ?? 0);
  const metaGroup = metaGroupById.get(metaGroupId);
  return {
    metaGroupId,
    metaGroup: english(metaGroup?.name, metaGroupId ? `Meta ${metaGroupId}` : 'Unclassified'),
    metaGroupRu: familiarMetaNamesRu.get(metaGroupId) ?? localized(metaGroup?.name, metaGroupId ? `Уровень ${metaGroupId}` : 'Без уровня'),
    metaLevel: Number(type.metaLevel ?? 0),
    techLevel: positiveInteger(Number(type.techLevel ?? 0)) || 1,
  };
}

function hullBonusPreferences(typeId) {
  const bonus = bonusById.get(typeId);
  const rows = [
    ...(bonus?.roleBonuses ?? []),
    ...(bonus?.types ?? []).flatMap((entry) => entry._value ?? []),
  ];
  const referencedIds = new Set();
  for (const row of rows) {
    const text = english(row?.bonusText, '');
    for (const match of text.matchAll(/showinfo:(\d+)/g)) referencedIds.add(Number(match[1]));
  }
  const skillIds = [];
  const groupIds = [];
  const terms = [];
  for (const referencedId of referencedIds) {
    const referencedType = typeById.get(referencedId);
    if (!referencedType) continue;
    const referencedInfo = groupInfo(referencedType);
    const referencedName = english(referencedType.name, '');
    if (referencedName) terms.push(referencedName);
    if (referencedInfo.categoryId === 16) skillIds.push(referencedId);
    else groupIds.push(referencedInfo.groupId);
  }
  return {
    bonusSkillIds: [...new Set(skillIds)].sort((a, b) => a - b),
    bonusGroupIds: [...new Set(groupIds)].sort((a, b) => a - b),
    bonusTerms: [...new Set(terms)].sort((a, b) => a.localeCompare(b, 'en')),
  };
}

const hulls = [];
const items = [];
const charges = [];

for (const type of typesRows) {
  if (type.published !== true) continue;
  const id = Number(type._key ?? type.typeID);
  const info = groupInfo(type);
  const { values, effects } = dogmaDetails(id);
  const name = english(type.name, `Type ${id}`);
  const common = {
    id,
    name,
    nameRu: localized(type.name, name),
    groupId: info.groupId,
    group: info.group,
    groupRu: info.groupRu,
  };

  if (info.categoryId === 6 || info.categoryId === 65) {
    const slots = {
      high: positiveInteger(values.hiSlots),
      mid: positiveInteger(values.medSlots),
      low: positiveInteger(values.lowSlots),
      rig: positiveInteger(values.rigSlots),
      subsystem: positiveInteger(values.maxSubSystems),
      service: positiveInteger(values.serviceSlots),
    };
    const hasSlots = Object.values(slots).some(Boolean);
    if (info.categoryId === 65 && !hasSlots) continue;
    hulls.push({
      ...common,
      kind: info.categoryId === 65 ? 'structure' : 'ship',
      techLevel: positiveInteger(values.techLevel) || 1,
      ...hullBonusPreferences(id),
      description: plainDescription(type),
      slots,
      resources: {
        cpu: Number(values.cpuOutput ?? 0),
        powergrid: Number(values.powerOutput ?? 0),
        calibration: Number(values.upgradeCapacity ?? 0),
        turrets: positiveInteger(values.turretSlotsLeft),
        launchers: positiveInteger(values.launcherSlotsLeft),
        rigSize: positiveInteger(values.rigSize),
        droneBay: Number(values.droneCapacity ?? 0),
        droneBandwidth: Number(values.droneBandwidth ?? 0),
        fighterBay: Number(values.fighterCapacity ?? 0),
        cargo: Number(type.capacity ?? values.capacity ?? 0),
      },
      defenses: {
        shield: Number(values.shieldCapacity ?? 0),
        armor: Number(values.armorHP ?? 0),
        hull: Number(values.hp ?? 0),
      },
    });
    continue;
  }

  if (info.categoryId === 8) {
    charges.push({
      ...common,
      ...metaInfo(type),
      chargeSize: positiveInteger(values.chargeSize),
      volume: Number(type.volume ?? 0),
    });
    continue;
  }

  const slot = slotFor(effects);
  const isDrone = info.categoryId === 18;
  const isFighter = info.categoryId === 87;
  if (!slot && !isDrone && !isFighter) continue;
  if (![7, 18, 32, 66, 87].includes(info.categoryId)) continue;

  items.push({
    ...common,
    ...metaInfo(type),
    categoryId: info.categoryId,
    category: info.category,
    categoryRu: info.categoryRu,
    slot: isDrone ? 'drone' : isFighter ? 'fighter' : slot,
    description: plainDescription(type),
    cpu: Number(values.cpu ?? 0),
    powergrid: Number(values.power ?? 0),
    calibration: Number(values.upgradeCost ?? 0),
    rigSize: positiveInteger(values.rigSize),
    chargeSize: positiveInteger(values.chargeSize),
    volume: Number(type.volume ?? 0),
    bandwidth: Number(values.droneBandwidthUsed ?? 0),
    turret: effects.has(42),
    launcher: effects.has(40),
    maxGroupFitted: positiveInteger(values.maxGroupFitted),
    maxTypeFitted: positiveInteger(values.maxTypeFitted),
    allowedGroupIds: [...new Set(matchingValues(values, /^(?:moduleShipGroup|canFitShipGroup)\d+$/))],
    allowedTypeIds: [...new Set(matchingValues(values, /^canFitShipType\d+$/))],
    chargeGroupIds: [...new Set(matchingValues(values, /^chargeGroup\d+$/))],
    subsystemSlot: positiveInteger(values.subSystemSlot),
    skills: skillRequirements(values),
    effects: displayDogmaEffects(id),
  });
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en') || a.id - b.id;
hulls.sort((a, b) => a.kind.localeCompare(b.kind, 'en') || byName(a, b));
items.sort((a, b) => a.slot.localeCompare(b.slot, 'en') || byName(a, b));
charges.sort(byName);

const sde = sdeRows[0] ?? {};
const payload = {
  meta: {
    sdeBuild: Number(sde.buildNumber ?? 0),
    releaseDate: String(sde.releaseDate ?? ''),
    hullCount: hulls.length,
    itemCount: items.length,
    chargeCount: charges.length,
    calculation: 'Базовые ограничения SDE: слоты, CPU, энергосеть, калибровка, точки установки, размер ригов и ограничения корпуса.',
  },
  hulls,
  items,
  charges,
};

await fs.mkdir(publicRoot, { recursive: true });
await fs.writeFile(path.join(publicRoot, 'eve-fitting-data.json'), JSON.stringify(payload));
console.log(`Fitting catalog: ${hulls.length} hulls, ${items.length} items, ${charges.length} charges.`);
