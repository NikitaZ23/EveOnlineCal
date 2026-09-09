'use client';

import { createElement, Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Box,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Factory,
  FlaskConical,
  Gem,
  LoaderCircle,
  Orbit,
  Pause,
  Pickaxe,
  Play,
  RotateCcw,
  Search,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FittingWorkbench from './FittingWorkbench';

type MineralYield = {
  id: number;
  name: string;
  quantity: number | null;
  minimum: number | null;
  maximum: number | null;
  random: boolean;
};

type Ore = {
  id: number;
  name: string;
  family: string;
  kind: string;
  grade: string;
  volume: number;
  portion: number;
  minerals: MineralYield[];
};

type Product = {
  id: number;
  name: string;
  quantity: number;
  group: string;
  groupRu?: string;
  category: string;
  categoryRu?: string;
};

type BlueprintMaterial = Product;

type ProductCharacteristicAttribute = {
  id: string | number;
  name: string;
  value: number;
  unitId: number | null;
  unit: string;
};

type ProductCharacteristics = {
  typeId: number;
  groups: Array<{
    id: number;
    name: string;
    attributes: ProductCharacteristicAttribute[];
  }>;
};

type EveModelEntry = {
  name: string;
  category: string;
  group: string;
  path: string;
};

type EveModelCatalog = {
  meta: {
    source: string;
    modelBaseUrl: string;
    count: number;
    notice: string;
  };
  models: Record<string, EveModelEntry>;
};

type ModelViewerElement = HTMLElement & {
  cameraOrbit: string;
  fieldOfView: string;
  jumpCameraToGoal?: () => void;
};

type BlueprintDefinition = {
  id: number;
  name: string;
  description: string;
  recipeStatus: 'available' | 'legacy' | 'unavailable';
  recipeNote: string;
  recipeSource: string;
  activity: 'manufacturing' | 'reaction';
  time: number;
  skills: SkillRequirement[];
  materials: BlueprintMaterial[];
  products: Product[];
};

type BlueprintProducer = {
  blueprint: BlueprintDefinition;
  product: Product;
};

type ProductionTimeEstimate = {
  sequentialSeconds: number;
  parallelSeconds: number;
  blueprintJobs: number;
  componentBlueprints: number;
  limitedBranches: number;
};

type BlueprintKind =
  | 'all'
  | 'ships'
  | 'weapons'
  | 'armor'
  | 'shields'
  | 'drones'
  | 'ammo'
  | 'rigs'
  | 'mining'
  | 'modules'
  | 'structures'
  | 'deployables'
  | 'components'
  | 'planetary'
  | 'subsystems'
  | 'implants'
  | 'other';

type BlueprintUse = {
  blueprintId: number;
  blueprintName: string;
  description: string;
  activity: 'manufacturing' | 'reaction';
  materialQuantity: number;
  time: number;
  products: Product[];
};

type Mineral = {
  id: number;
  name: string;
  blueprints: BlueprintUse[];
};

type PlanetaryTier = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

type PlanetaryRecipe = {
  id: number;
  name: string;
  cycleTime: number;
  outputQuantity: number;
  inputs: Array<{ id: number; name: string; quantity: number }>;
};

type PlanetaryCommodity = {
  id: number;
  name: string;
  tier: PlanetaryTier;
  volume: number;
  planets: string[];
  recipe: PlanetaryRecipe | null;
};

type PlanetType = {
  id: string;
  typeId: number;
  name: string;
  nameEn: string;
  resources: number[];
};

type SkillRequirement = {
  id: number;
  name: string;
  level: number;
};

type EveSkill = {
  id: number;
  name: string;
  description: string;
  groupId: number;
  group: string;
  groupRu: string;
  rank: number;
  primaryAttribute: string;
  secondaryAttribute: string;
  requirements: SkillRequirement[];
};

type ActiveTab = 'chain' | 'sources' | 'blueprints' | 'planetary' | 'skills' | 'fitting';
type BlueprintTreeMode = 'materials' | 'skills';

type BlueprintHistoryEntry = {
  blueprintId: number;
  catalogQuery: string;
  catalogActivity: 'all' | 'manufacturing' | 'reaction';
  catalogKind: BlueprintKind;
  catalogGroup: string;
};

type SkillHistoryEntry = {
  skillId: number;
  skillQuery: string;
  skillGroup: string;
};

type SavedWorkspaceState = {
  activeTab?: ActiveTab;
  oreQuery?: string;
  mineralQuery?: string;
  blueprintQuery?: string;
  catalogQuery?: string;
  planetaryQuery?: string;
  activity?: 'all' | 'manufacturing' | 'reaction';
  catalogActivity?: 'all' | 'manufacturing' | 'reaction';
  catalogKind?: BlueprintKind;
  catalogGroup?: string;
  planetaryTier?: 'all' | PlanetaryTier;
  skillQuery?: string;
  skillGroup?: string;
  skillTargetLevel?: 1 | 2 | 3 | 4 | 5;
  blueprintTreeMode?: BlueprintTreeMode;
  blueprintHistory?: Array<number | BlueprintHistoryEntry>;
  skillHistory?: Array<number | SkillHistoryEntry>;
  selectedOreId?: number | null;
  selectedMineralId?: number | null;
  sourceMineralId?: number | null;
  dependencyBlueprintId?: number | null;
  selectedPlanetaryId?: number | null;
  selectedSkillId?: number | null;
};

type ProductionData = {
  meta: {
    sdeBuild: number;
    releaseDate: string;
    oreCount: number;
    mineralCount: number;
    blueprintUseCount: number;
    uniqueBlueprintActivities: number;
    skillCount: number;
  };
  ores: Ore[];
  minerals: Mineral[];
  blueprints: BlueprintDefinition[];
  planetary: {
    sourceUrl: string;
    planets: PlanetType[];
    commodities: PlanetaryCommodity[];
  };
  skills: EveSkill[];
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown | Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const numberFormat = new Intl.NumberFormat('ru-RU');
const compactFormat = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const PAGE_SIZE = 80;
const BLUEPRINT_PAGE_SIZE = 160;
const SKILL_PAGE_SIZE = 160;
const CHARACTERISTIC_BUCKET_COUNT = 64;
const WORKSPACE_STATE_KEY = 'eve-production-tree:workspace:v1';
const activeTabs = new Set<ActiveTab>(['chain', 'sources', 'blueprints', 'planetary', 'skills', 'fitting']);
const characteristicBucketCache = new Map<number, Promise<Record<string, ProductCharacteristics>>>();
const modelCapableCategories = new Set([
  'celestial',
  'deployable',
  'drone',
  'entity',
  'fighter',
  'orbitals',
  'ship',
  'starbase',
  'station',
  'structure',
  'subsystem',
]);
let eveModelCatalogRequest: Promise<EveModelCatalog> | null = null;
let modelViewerScriptRequest: Promise<void> | null = null;

const blueprintKindLabels: Record<Exclude<BlueprintKind, 'all'>, string> = {
  ships: 'Корабли',
  weapons: 'Оружие',
  armor: 'Броня',
  shields: 'Щиты',
  drones: 'Дроны и истребители',
  ammo: 'Боеприпасы и заряды',
  rigs: 'Риги',
  mining: 'Добыча ресурсов',
  modules: 'Другие модули',
  structures: 'Сооружения',
  deployables: 'Развёртываемые объекты',
  components: 'Материалы и компоненты',
  planetary: 'Планетарка',
  subsystems: 'Подсистемы',
  implants: 'Импланты и бустеры',
  other: 'Прочее',
};

const planetaryTierLabels: Record<PlanetaryTier, string> = {
  P0: 'Сырьё',
  P1: 'Базовые материалы',
  P2: 'Обработанные товары',
  P3: 'Специализированные товары',
  P4: 'Высокотехнологичные товары',
};

function iconUrl(id: number) {
  return `https://images.evetech.net/types/${id}/icon?size=64`;
}

function productIconUrl(id: number) {
  return `https://images.evetech.net/types/${id}/icon?size=64`;
}

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  if (seconds >= 86400) return `${Math.round(seconds / 8640) / 10} д`;
  if (seconds >= 3600) return `${Math.round(seconds / 360) / 10} ч`;
  return `${Math.max(1, Math.round(seconds / 60))} мин`;
}

function formatEstimatedDuration(seconds: number) {
  return seconds > 0 ? formatDuration(seconds) : '0 мин';
}

function loadProductCharacteristics(typeId: number) {
  const bucketId = typeId % CHARACTERISTIC_BUCKET_COUNT;
  let request = characteristicBucketCache.get(bucketId);
  if (!request) {
    request = fetch(`/product-characteristics/${bucketId}.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Characteristics request failed');
        return response.json() as Promise<Record<string, ProductCharacteristics>>;
      })
      .catch((error) => {
        characteristicBucketCache.delete(bucketId);
        throw error;
      });
    characteristicBucketCache.set(bucketId, request);
  }
  return request.then((bucket) => bucket[String(typeId)] ?? null);
}

function loadEveModelCatalog() {
  if (!eveModelCatalogRequest) {
    eveModelCatalogRequest = fetch('/eve-3d-models.json')
      .then((response) => {
        if (!response.ok) throw new Error('3D model catalog request failed');
        return response.json() as Promise<EveModelCatalog>;
      })
      .catch((error) => {
        eveModelCatalogRequest = null;
        throw error;
      });
  }
  return eveModelCatalogRequest;
}

function loadModelViewerScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  const modelViewerGlobal = window as typeof window & {
    ModelViewerElement?: { meshoptDecoderLocation?: string };
  };
  modelViewerGlobal.ModelViewerElement ??= {};
  modelViewerGlobal.ModelViewerElement.meshoptDecoderLocation ||= '/meshopt-decoder.js';
  if (window.customElements.get('model-viewer')) return Promise.resolve();
  if (modelViewerScriptRequest) return modelViewerScriptRequest;

  modelViewerScriptRequest = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-eve-model-viewer]');
    const script = existing ?? document.createElement('script');
    const handleLoad = () => resolve();
    const handleError = () => {
      modelViewerScriptRequest = null;
      reject(new Error('3D viewer script failed'));
    };
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existing) {
      script.type = 'module';
      script.src = '/model-viewer.min.js';
      script.dataset.eveModelViewer = 'true';
      document.head.appendChild(script);
    }
  });
  return modelViewerScriptRequest;
}

function BlueprintModelPreview({ product }: { product: Product | undefined }) {
  const [catalog, setCatalog] = useState<EveModelCatalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [autoRotate, setAutoRotate] = useState(true);
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const canHaveModel = Boolean(product && modelCapableCategories.has(product.category.toLocaleLowerCase('en')));
  const model = product ? catalog?.models[String(product.id)] : undefined;

  useEffect(() => {
    if (!canHaveModel) return;
    let cancelled = false;
    setCatalogFailed(false);
    loadEveModelCatalog()
      .then((result) => {
        if (!cancelled) setCatalog(result);
      })
      .catch(() => {
        if (!cancelled) setCatalogFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canHaveModel]);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    setModelState('loading');
    loadModelViewerScript().catch(() => {
      if (!cancelled) setModelState('error');
    });
    const viewer = viewerRef.current;
    if (!viewer) return () => {
      cancelled = true;
    };
    const handleLoad = () => {
      if (!cancelled) setModelState('ready');
    };
    const handleError = () => {
      if (!cancelled) setModelState('error');
    };
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    return () => {
      cancelled = true;
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [model]);

  if (!canHaveModel) return null;

  const modelUrl = model && catalog
    ? new URL(model.path, catalog.meta.modelBaseUrl).href
    : '';
  const resetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.cameraOrbit = 'auto auto auto';
    viewer.fieldOfView = 'auto';
    viewer.jumpCameraToGoal?.();
  };

  return (
    <aside className="blueprint-model-preview" aria-label={`Трёхмерная модель ${product?.name ?? ''}`}>
      <div className="blueprint-model-head">
        <div>
          <span><Box aria-hidden="true" />3D-модель результата</span>
          <strong>{product?.name}</strong>
        </div>
        {model && (
          <div className="blueprint-model-actions">
            <button
              type="button"
              onClick={() => setAutoRotate((enabled) => !enabled)}
              aria-label={autoRotate ? 'Остановить вращение' : 'Включить вращение'}
              aria-pressed={autoRotate}
              title={autoRotate ? 'Остановить вращение' : 'Включить вращение'}
            >
              {autoRotate ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button type="button" onClick={resetCamera} aria-label="Сбросить вид" title="Сбросить вид">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="blueprint-model-stage">
        {!catalog && !catalogFailed && (
          <div className="blueprint-model-status"><LoaderCircle className="spin" aria-hidden="true" />Ищу модель…</div>
        )}
        {catalogFailed && <div className="blueprint-model-status">Каталог моделей недоступен</div>}
        {catalog && !model && <div className="blueprint-model-status">Для этого предмета 3D-модель не найдена</div>}
        {model && createElement('model-viewer', {
          ref: viewerRef,
          src: modelUrl,
          alt: `3D-модель ${product?.name ?? model.name}`,
          poster: product ? productIconUrl(product.id) : undefined,
          'camera-controls': '',
          'auto-rotate': autoRotate ? '' : undefined,
          'auto-rotate-delay': '800',
          'rotation-per-second': '18deg',
          'interaction-prompt': 'none',
          'shadow-intensity': '1',
          loading: 'eager',
        })}
        {model && modelState === 'loading' && (
          <div className="blueprint-model-loading"><LoaderCircle className="spin" aria-hidden="true" />Загружаю 3D…</div>
        )}
        {model && modelState === 'error' && (
          <div className="blueprint-model-status">Не удалось загрузить модель</div>
        )}
      </div>
      <div className="blueprint-model-foot">
        <span>Тяните мышью — вращать · колесо — приблизить или отдалить</span>
        <a href="https://github.com/EstamelGG/EVE_Model_Gallery" target="_blank" rel="noreferrer">Источник модели</a>
      </div>
    </aside>
  );
}

function formatCharacteristicValue(attribute: ProductCharacteristicAttribute) {
  const format = (value: number) => numberFormat.format(Math.round(value * 100) / 100);
  if (attribute.unitId === 101) return formatDuration(attribute.value / 1000);
  if (attribute.unitId === 108 || attribute.unitId === 111) return `${format((1 - attribute.value) * 100)} %`;
  if (attribute.unitId === 109) return `${format((attribute.value - 1) * 100)} %`;
  if (attribute.unitId === 104) return `× ${format(attribute.value)}`;
  if (attribute.unitId === 117) {
    return ({ 1: 'Малый', 2: 'Средний', 3: 'Большой', 4: 'Сверхбольшой' } as Record<number, string>)[attribute.value]
      ?? format(attribute.value);
  }
  if (attribute.unitId === 123) return formatDuration(attribute.value);
  if (attribute.unitId === 129) return `${format(attribute.value)} ч`;
  const unit = attribute.unit.replaceAll('м^3', 'м³').replaceAll('m3', 'м³');
  return `${format(attribute.value)}${unit ? ` ${unit}` : ''}`;
}

function yieldLabel(item: MineralYield) {
  if (item.random) return `${numberFormat.format(item.minimum ?? 0)}–${numberFormat.format(item.maximum ?? 0)}`;
  return numberFormat.format(item.quantity ?? 0);
}

function mineralOriginRank(ores: Ore[], mineralId: number) {
  const sources = ores.filter((ore) => ore.minerals.some((item) => item.id === mineralId));
  if (sources.some((ore) => ore.kind === 'Астероидная')) return 0;
  if (sources.some((ore) => ore.kind.startsWith('Лунная'))) return 1;
  if (sources.some((ore) => ore.kind === 'Лёд')) return 2;
  return 3;
}

function mineralOriginLabel(rank: number) {
  if (rank === 0) return 'Из астероидной руды';
  if (rank === 1) return 'Из лунной руды';
  if (rank === 2) return 'Изо льда';
  return 'Другие источники';
}

function activityLabel(activity: BlueprintDefinition['activity']) {
  return activity === 'reaction' ? 'Реакция' : 'Производство';
}

function blueprintKind(product: Product | undefined): Exclude<BlueprintKind, 'all'> {
  if (!product) return 'other';
  const category = product.category.toLocaleLowerCase('en');
  const group = product.group.toLocaleLowerCase('en');

  if (category === 'ship') return 'ships';
  if (category === 'drone' || category === 'fighter') return 'drones';
  if (category === 'charge') return 'ammo';
  if (category === 'implant') return 'implants';
  if (category === 'subsystem') return 'subsystems';
  if (category === 'deployable') return 'deployables';
  if (category === 'planetary') return 'planetary';
  if (
    ['structure', 'structure module', 'starbase', 'infrastructure upgrades', 'orbitals', 'sovereignty structures'].includes(
      category,
    )
  ) {
    return 'structures';
  }
  if (category === 'material' || category === 'commodity') return 'components';

  if (category === 'module') {
    if (group.startsWith('rig ')) return 'rigs';
    if (/armor|hull repair|damage control|reinforced bulkhead/.test(group)) return 'armor';
    if (/shield/.test(group)) return 'shields';
    if (/drone|fighter/.test(group)) return 'drones';
    if (/mining|harvester|strip miner|compressor/.test(group)) return 'mining';
    if (/weapon|laser|launcher|projector|smart bomb|energy neutralizer|energy nosferatu|bomb launcher/.test(group)) {
      return 'weapons';
    }
    return 'modules';
  }

  return 'other';
}

function estimateBlueprintProductionTime(
  blueprint: BlueprintDefinition,
  runs: number,
  producersByProductId: Map<number, BlueprintProducer[]>,
): ProductionTimeEstimate {
  type PlannedComponent = BlueprintProducer & {
    demand: number;
    runs: number;
  };

  const ownSeconds = Math.max(0, blueprint.time) * runs;
  if (blueprint.recipeStatus === 'unavailable') {
    return {
      sequentialSeconds: ownSeconds,
      parallelSeconds: ownSeconds,
      blueprintJobs: runs,
      componentBlueprints: 0,
      limitedBranches: 1,
    };
  }

  const componentPlan = new Map<number, PlannedComponent>();
  const limitedBranches = new Set<string>();

  function addDemand(productId: number, quantity: number, depth: number, path: Set<number>) {
    if (quantity <= 0) return;
    const producers = producersByProductId.get(productId) ?? [];
    if (!producers.length) return;
    if (depth > 8) {
      limitedBranches.add(`depth:${productId}`);
      return;
    }

    const existing = componentPlan.get(productId);
    const producer = existing ?? producers.find(({ blueprint: candidate }) => !path.has(candidate.id));
    if (!producer || path.has(producer.blueprint.id)) {
      limitedBranches.add(`cycle:${productId}`);
      return;
    }

    const planned = existing ?? {
      ...producer,
      demand: 0,
      runs: 0,
    };
    if (!existing) componentPlan.set(productId, planned);

    planned.demand += quantity;
    const requiredRuns = Math.ceil(planned.demand / Math.max(1, planned.product.quantity));
    const additionalRuns = Math.max(0, requiredRuns - planned.runs);
    if (!additionalRuns) return;

    planned.runs += additionalRuns;
    if (planned.blueprint.recipeStatus === 'unavailable') {
      limitedBranches.add(`unavailable:${planned.blueprint.id}`);
      return;
    }

    const nextPath = new Set(path);
    nextPath.add(planned.blueprint.id);
    for (const material of planned.blueprint.materials) {
      addDemand(material.id, material.quantity * additionalRuns, depth + 1, nextPath);
    }
  }

  const rootPath = new Set([blueprint.id]);
  for (const material of blueprint.materials) {
    addDemand(material.id, material.quantity * runs, 1, rootPath);
  }

  function criticalPathSeconds(currentBlueprint: BlueprintDefinition, currentRuns: number, path: Set<number>): number {
    const nextPath = new Set(path);
    nextPath.add(currentBlueprint.id);
    let longestDependency = 0;
    for (const material of currentBlueprint.materials) {
      const planned = componentPlan.get(material.id);
      if (!planned || nextPath.has(planned.blueprint.id)) continue;
      longestDependency = Math.max(
        longestDependency,
        criticalPathSeconds(planned.blueprint, planned.runs, nextPath),
      );
    }
    return Math.max(0, currentBlueprint.time) * currentRuns + longestDependency;
  }

  const componentSeconds = [...componentPlan.values()].reduce(
    (sum, planned) => sum + Math.max(0, planned.blueprint.time) * planned.runs,
    0,
  );
  const componentRuns = [...componentPlan.values()].reduce((sum, planned) => sum + planned.runs, 0);

  return {
    sequentialSeconds: ownSeconds + componentSeconds,
    parallelSeconds: criticalPathSeconds(blueprint, runs, new Set<number>()),
    blueprintJobs: runs + componentRuns,
    componentBlueprints: componentPlan.size,
    limitedBranches: limitedBranches.size,
  };
}

function formatSkillLevel(level: number) {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][level] ?? numberFormat.format(level);
}

function skillPointsToLevel(rank: number, level: number) {
  return Math.floor(250 * rank * (2 ** (2.5 * (level - 1))));
}

function omegaTrainingSeconds(skill: EveSkill, level: number) {
  const basePrimaryAttribute = 20;
  const baseSecondaryAttribute = 20;
  const skillPointsPerMinute = basePrimaryAttribute + baseSecondaryAttribute / 2;
  return skillPointsToLevel(skill.rank, level) / skillPointsPerMinute * 60;
}

function formatSkillTrainingDuration(seconds: number) {
  let minutes = Math.max(0, Math.ceil(seconds / 60));
  if (!minutes) return '0 мин';
  const units = [
    { size: 525600, label: 'г' },
    { size: 1440, label: 'д' },
    { size: 60, label: 'ч' },
    { size: 1, label: 'мин' },
  ];
  const parts: string[] = [];
  for (const unit of units) {
    const value = Math.floor(minutes / unit.size);
    if (!value) continue;
    parts.push(`${numberFormat.format(value)} ${unit.label}`);
    minutes -= value * unit.size;
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

function collectSkillPrerequisites(
  skill: EveSkill,
  skillById: Map<number, EveSkill>,
  requiredLevels: Map<number, number>,
  traversed: Set<number>,
) {
  for (const requirement of skill.requirements) {
    requiredLevels.set(
      requirement.id,
      Math.max(requiredLevels.get(requirement.id) ?? 0, requirement.level),
    );
    if (traversed.has(requirement.id)) continue;
    traversed.add(requirement.id);
    const requiredSkill = skillById.get(requirement.id);
    if (requiredSkill) collectSkillPrerequisites(requiredSkill, skillById, requiredLevels, traversed);
  }
}

function SkillDependencyBranch({
  skill,
  requiredLevel,
  depth,
  path,
  skillById,
  onSelectSkill,
  root = false,
}: {
  skill: EveSkill;
  requiredLevel?: number;
  depth: number;
  path: Set<number>;
  skillById: Map<number, EveSkill>;
  onSelectSkill: (skillId: number) => void;
  root?: boolean;
}) {
  const nextPath = new Set(path);
  nextPath.add(skill.id);
  const content = (
    <>
      <img src={productIconUrl(skill.id)} alt="" loading="lazy" />
      <div className="dependency-node-copy">
        <span className="eyebrow">{root ? 'Выбранный навык' : 'Требуемый навык'}</span>
        <strong>{skill.name}</strong>
        <small>{skill.groupRu}</small>
      </div>
      <div className="dependency-quantity">
        {root ? (
          <>
            <span>Множитель</span>
            <b>× {numberFormat.format(skill.rank)}</b>
            <small>{skill.requirements.length} прямых требований</small>
          </>
        ) : (
          <>
            <span>Требуется</span>
            <b>Уровень {formatSkillLevel(requiredLevel ?? 1)}</b>
            <small>{skill.requirements.length ? `${skill.requirements.length} требований · открыть` : 'базовый навык · открыть'}</small>
            <ChevronRight className="dependency-open-icon" aria-hidden="true" />
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="dependency-branch">
      {root ? (
        <article className="dependency-node skill-dependency-node dependency-root-node">{content}</article>
      ) : (
        <button
          type="button"
          className="dependency-node skill-dependency-node"
          onClick={() => onSelectSkill(skill.id)}
          aria-label={`Открыть навык ${skill.name}`}
        >
          {content}
        </button>
      )}

      {!!skill.requirements.length && (
        <div className="dependency-children">
          {skill.requirements.map((requirement) => {
            const requiredSkill = skillById.get(requirement.id);
            if (requiredSkill && !nextPath.has(requiredSkill.id) && depth < 8) {
              return (
                <SkillDependencyBranch
                  key={`${skill.id}-${requirement.id}`}
                  skill={requiredSkill}
                  requiredLevel={requirement.level}
                  depth={depth + 1}
                  path={nextPath}
                  skillById={skillById}
                  onSelectSkill={onSelectSkill}
                />
              );
            }
            return (
              <div className="dependency-branch" key={`${skill.id}-${requirement.id}`}>
                <article className="dependency-node dependency-material-node skill-missing-node">
                  <img src={productIconUrl(requirement.id)} alt="" loading="lazy" />
                  <div className="dependency-node-copy">
                    <span className="eyebrow">Требуемый навык</span>
                    <strong>{requirement.name}</strong>
                    <small>{depth >= 8 ? 'Предел глубины дерева' : 'Запись навыка недоступна'}</small>
                  </div>
                  <div className="dependency-quantity">
                    <span>Требуется</span>
                    <b>Уровень {formatSkillLevel(requirement.level)}</b>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlueprintSkillTree({
  blueprint,
  skillById,
  onSelectSkill,
  totalSkillCount,
}: {
  blueprint: BlueprintDefinition;
  skillById: Map<number, EveSkill>;
  onSelectSkill: (skillId: number) => void;
  totalSkillCount: number;
}) {
  const product = blueprint.products[0];
  return (
    <div className="dependency-branch">
      <article className="dependency-node blueprint-skill-root dependency-root-node">
        <img src={productIconUrl(product?.id ?? blueprint.id)} alt="" loading="lazy" />
        <div className="dependency-node-copy">
          <span className="eyebrow">Выбранный чертёж</span>
          <strong>{product?.name ?? blueprint.name}</strong>
          <small>{blueprint.name} · {activityLabel(blueprint.activity)}</small>
        </div>
        <div className="dependency-quantity">
          <span>Требования</span>
          <b>{numberFormat.format(blueprint.skills.length)} прямых</b>
          <small>{numberFormat.format(totalSkillCount)} всего в цепочке</small>
        </div>
      </article>

      <div className="dependency-children">
        {blueprint.skills.map((requirement) => {
          const skill = skillById.get(requirement.id);
          if (skill) {
            return (
              <SkillDependencyBranch
                key={`${blueprint.id}-${requirement.id}`}
                skill={skill}
                requiredLevel={requirement.level}
                depth={1}
                path={new Set<number>()}
                skillById={skillById}
                onSelectSkill={onSelectSkill}
              />
            );
          }
          return (
            <div className="dependency-branch" key={`${blueprint.id}-${requirement.id}`}>
              <article className="dependency-node dependency-material-node skill-missing-node">
                <img src={productIconUrl(requirement.id)} alt="" loading="lazy" />
                <div className="dependency-node-copy">
                  <span className="eyebrow">Требуемый навык</span>
                  <strong>{requirement.name}</strong>
                  <small>Запись навыка недоступна</small>
                </div>
                <div className="dependency-quantity">
                  <span>Требуется</span>
                  <b>Уровень {formatSkillLevel(requirement.level)}</b>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlueprintDependencyBranch({
  blueprint,
  requiredQuantity,
  runs,
  depth,
  path,
  mineralById,
  producersByProductId,
  oreSourcesByMineralId,
  planetaryCommodityById,
  planetById,
  onSelectBlueprint,
  root = false,
  rootAside,
}: {
  blueprint: BlueprintDefinition;
  requiredQuantity: number;
  runs: number;
  depth: number;
  path: Set<number>;
  mineralById: Map<number, Mineral>;
  producersByProductId: Map<number, BlueprintProducer[]>;
  oreSourcesByMineralId: Map<number, Array<{ ore: Ore; mineral: MineralYield }>>;
  planetaryCommodityById: Map<number, PlanetaryCommodity>;
  planetById: Map<string, PlanetType>;
  onSelectBlueprint: (blueprintId: number) => void;
  root?: boolean;
  rootAside?: ReactNode;
}) {
  const primaryProduct = blueprint.products[0];
  const isPlanetaryBlueprint = blueprintKind(primaryProduct) === 'planetary';
  const nextPath = new Set(path);
  nextPath.add(blueprint.id);

  return (
    <div className="dependency-branch">
      {root ? (
        <div className="dependency-root-row">
          {rootAside}
          <article className="dependency-node dependency-blueprint-node dependency-root-node">
            <img src={productIconUrl(primaryProduct?.id ?? blueprint.id)} alt="" loading="lazy" />
            <div className="dependency-node-copy">
              <span className="eyebrow">{isPlanetaryBlueprint ? 'Выбранная схема PI' : 'Выбранный чертёж'}</span>
              <strong>{blueprint.name}</strong>
              <small>
                {primaryProduct?.name ?? 'Продукт'} × {numberFormat.format(primaryProduct?.quantity ?? 1)} · {isPlanetaryBlueprint ? 'Планетарное производство' : activityLabel(blueprint.activity)}
              </small>
            </div>
            <div className="dependency-quantity">
              {blueprint.recipeStatus === 'unavailable' ? (
                <>
                  <b>Состав отсутствует</b>
                  <small>устаревшая запись SDE</small>
                </>
              ) : blueprint.recipeStatus === 'legacy' ? (
                <>
                  <span>Время создания</span>
                  <b>{formatDuration(blueprint.time)}</b>
                  <small>1 запуск · EVE SDE</small>
                </>
              ) : (
                <>
                  <b>1 запуск</b>
                  <small>{formatDuration(blueprint.time)}</small>
                </>
              )}
            </div>
          </article>
        </div>
      ) : (
        <button
          type="button"
          className="dependency-node dependency-blueprint-node"
          onClick={() => onSelectBlueprint(blueprint.id)}
          aria-label={`Открыть ${blueprint.name} как выбранный чертёж`}
        >
          <img src={productIconUrl(primaryProduct?.id ?? blueprint.id)} alt="" loading="lazy" />
          <div className="dependency-node-copy">
            <span className="eyebrow">{isPlanetaryBlueprint ? 'Планетарная схема' : 'Чертёж компонента'}</span>
            <strong>{blueprint.name}</strong>
            <small>
              {primaryProduct?.name ?? 'Продукт'} × {numberFormat.format(primaryProduct?.quantity ?? 1)} · {isPlanetaryBlueprint ? 'Планетарное производство' : activityLabel(blueprint.activity)}
            </small>
          </div>
          <div className="dependency-quantity">
            <span>Нужно</span>
            <b>× {numberFormat.format(requiredQuantity)}</b>
            <small>{numberFormat.format(runs)} запуск. · открыть</small>
            <ChevronRight className="dependency-open-icon" aria-hidden="true" />
          </div>
        </button>
      )}

      {!!blueprint.materials.length && (
        <div className="dependency-children">
          {blueprint.materials.map((material) => (
            <DependencyMaterialBranch
              key={`${blueprint.id}-${material.id}`}
              material={material}
              requiredQuantity={material.quantity * runs}
              depth={depth + 1}
              path={nextPath}
              mineralById={mineralById}
              producersByProductId={producersByProductId}
              oreSourcesByMineralId={oreSourcesByMineralId}
              planetaryCommodityById={planetaryCommodityById}
              planetById={planetById}
              onSelectBlueprint={onSelectBlueprint}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DependencyMaterialBranch({
  material,
  requiredQuantity,
  depth,
  path,
  mineralById,
  producersByProductId,
  oreSourcesByMineralId,
  planetaryCommodityById,
  planetById,
  onSelectBlueprint,
}: {
  material: BlueprintMaterial;
  requiredQuantity: number;
  depth: number;
  path: Set<number>;
  mineralById: Map<number, Mineral>;
  producersByProductId: Map<number, BlueprintProducer[]>;
  oreSourcesByMineralId: Map<number, Array<{ ore: Ore; mineral: MineralYield }>>;
  planetaryCommodityById: Map<number, PlanetaryCommodity>;
  planetById: Map<string, PlanetType>;
  onSelectBlueprint: (blueprintId: number) => void;
}) {
  const mineral = mineralById.get(material.id);
  if (mineral) {
    return (
      <MineralDependencyBranch
        mineral={mineral}
        requiredQuantity={requiredQuantity}
        sources={oreSourcesByMineralId.get(mineral.id) ?? []}
      />
    );
  }

  const producers = producersByProductId.get(material.id) ?? [];
  const producer = producers.find(({ blueprint }) => !path.has(blueprint.id));
  if (producer && depth <= 8) {
    const runs = Math.max(1, Math.ceil(requiredQuantity / Math.max(1, producer.product.quantity)));
    return (
      <BlueprintDependencyBranch
        blueprint={producer.blueprint}
        requiredQuantity={requiredQuantity}
        runs={runs}
        depth={depth}
        path={path}
        mineralById={mineralById}
        producersByProductId={producersByProductId}
        oreSourcesByMineralId={oreSourcesByMineralId}
        planetaryCommodityById={planetaryCommodityById}
        planetById={planetById}
        onSelectBlueprint={onSelectBlueprint}
      />
    );
  }

  const planetaryCommodity = planetaryCommodityById.get(material.id);
  if (planetaryCommodity?.tier === 'P0') {
    return (
      <PlanetaryRawDependencyBranch
        commodity={planetaryCommodity}
        requiredQuantity={requiredQuantity}
        planetById={planetById}
      />
    );
  }

  return (
    <div className="dependency-branch">
      <article className="dependency-node dependency-material-node">
        <img src={productIconUrl(material.id)} alt="" loading="lazy" />
        <div className="dependency-node-copy">
          <span className="eyebrow">Материал</span>
          <strong>{material.name}</strong>
          <small>{material.group}</small>
        </div>
        <div className="dependency-quantity">
          <span>Нужно</span>
          <b>× {numberFormat.format(requiredQuantity)}</b>
          <small>{path.size >= 8 ? 'предел глубины' : 'готовое сырьё'}</small>
        </div>
      </article>
    </div>
  );
}

function PlanetaryRawDependencyBranch({
  commodity,
  requiredQuantity,
  planetById,
}: {
  commodity: PlanetaryCommodity;
  requiredQuantity: number;
  planetById: Map<string, PlanetType>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="dependency-branch">
      <button
        type="button"
        className="dependency-node dependency-planetary-node"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <img src={productIconUrl(commodity.id)} alt="" loading="lazy" />
        <div className="dependency-node-copy">
          <span className="eyebrow">P0 · Планетарное сырьё</span>
          <strong>{commodity.name}</strong>
          <small>{commodity.planets.length} типов планет · нажмите, чтобы {expanded ? 'скрыть' : 'показать'}</small>
        </div>
        <div className="dependency-quantity">
          <span>Нужно</span>
          <b>× {numberFormat.format(requiredQuantity)}</b>
          {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </div>
      </button>

      {expanded && (
        <div className="pi-inline-planets dependency-p0-planets">
          <span>Добывается на планетах</span>
          <div>
            {commodity.planets.map((planetId) => {
              const planet = planetById.get(planetId);
              return planet ? (
                <article className={`pi-inline-planet pi-planet-${planet.id}`} key={planet.id}>
                  <img src={productIconUrl(planet.typeId)} alt="" loading="lazy" />
                  <div>
                    <strong>{planet.name}</strong>
                    <small>{planet.nameEn}</small>
                  </div>
                </article>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MineralDependencyBranch({
  mineral,
  requiredQuantity,
  sources,
}: {
  mineral: Mineral;
  requiredQuantity: number;
  sources: Array<{ ore: Ore; mineral: MineralYield }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="dependency-branch">
      <button
        type="button"
        className="dependency-node dependency-mineral-node"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <img src={iconUrl(mineral.id)} alt="" loading="lazy" />
        <div className="dependency-node-copy">
          <span className="eyebrow">Минерал</span>
          <strong>{mineral.name}</strong>
          <small>{sources.length} источников руды и льда · нажмите, чтобы {expanded ? 'скрыть' : 'показать'}</small>
        </div>
        <div className="dependency-quantity">
          <span>Нужно</span>
          <b>× {numberFormat.format(requiredQuantity)}</b>
          {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </div>
      </button>

      {expanded && (
        <div className="dependency-children dependency-ore-children">
          {sources.map(({ ore, mineral: oreYield }) => {
            const output = oreYield.random ? null : oreYield.quantity ?? 0;
            const batches = output ? Math.ceil(requiredQuantity / output) : null;
            return (
              <div className="dependency-branch" key={ore.id}>
                <article className="dependency-node dependency-ore-node">
                  <img src={iconUrl(ore.id)} alt="" loading="lazy" />
                  <div className="dependency-node-copy">
                    <span className="eyebrow">Руда · {ore.kind}</span>
                    <strong>{ore.name}</strong>
                    <small>Выход {yieldLabel(oreYield)} за партию из {numberFormat.format(ore.portion)} ед.</small>
                  </div>
                  <div className="dependency-quantity">
                    <span>{batches ? 'Примерно' : 'Выход'}</span>
                    <b>{batches ? `${numberFormat.format(batches)} парт.` : yieldLabel(oreYield)}</b>
                    <small>
                      {batches
                        ? `${numberFormat.format(batches * ore.portion)} ед. ${ore.kind === 'Лёд' ? 'льда' : 'руды'}`
                        : 'случайно'}
                    </small>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanetaryDependencyBranch({
  commodity,
  requiredQuantity,
  runs,
  commodityById,
  planetById,
  root = false,
}: {
  commodity: PlanetaryCommodity;
  requiredQuantity: number;
  runs: number;
  commodityById: Map<number, PlanetaryCommodity>;
  planetById: Map<string, PlanetType>;
  root?: boolean;
}) {
  const [planetsExpanded, setPlanetsExpanded] = useState(false);
  const recipe = commodity.recipe;
  const isExpandableP0 = commodity.tier === 'P0' && !root;
  const nodeClassName = `pi-dependency-node pi-tier-${commodity.tier.toLocaleLowerCase('en')}${root ? ' pi-root-node' : ''}${planetsExpanded ? ' is-expanded' : ''}`;
  const nodeContents = (
    <>
      <img src={productIconUrl(commodity.id)} alt="" loading="lazy" />
      <div className="pi-node-copy">
        <span className="pi-tier-label">{commodity.tier} · {planetaryTierLabels[commodity.tier]}</span>
        <strong>{commodity.name}</strong>
        {commodity.tier === 'P0' ? (
          <small>
            {commodity.planets.length} типов планет · нажмите, чтобы {planetsExpanded ? 'свернуть' : 'развернуть'} список
          </small>
        ) : (
          <small>{recipe?.name} · {formatDuration(recipe?.cycleTime ?? 0)}</small>
        )}
      </div>
      <div className="pi-node-quantity">
        <span>{root ? (recipe ? 'Выход' : 'Ресурс') : 'Нужно'}</span>
        <b>× {numberFormat.format(root ? recipe?.outputQuantity ?? 1 : requiredQuantity)}</b>
        {isExpandableP0 ? (
          <ChevronDown className={planetsExpanded ? 'is-expanded' : ''} aria-hidden="true" />
        ) : (
          <small>{root ? `${commodity.volume} м³/ед.` : recipe ? `${numberFormat.format(runs)} цикл.` : `${commodity.volume} м³/ед.`}</small>
        )}
      </div>
    </>
  );

  return (
    <div className="pi-dependency-branch">
      {isExpandableP0 ? (
        <button
          type="button"
          className={nodeClassName}
          aria-expanded={planetsExpanded}
          onClick={() => setPlanetsExpanded((expanded) => !expanded)}
        >
          {nodeContents}
        </button>
      ) : (
        <article className={nodeClassName}>{nodeContents}</article>
      )}

      {isExpandableP0 && planetsExpanded && (
        <div className="pi-inline-planets">
          <span>Добывается на планетах</span>
          <div>
            {commodity.planets.map((planetId) => {
              const planet = planetById.get(planetId);
              return planet ? (
                <article className={`pi-inline-planet pi-planet-${planet.id}`} key={planet.id}>
                  <img src={productIconUrl(planet.typeId)} alt="" loading="lazy" />
                  <div>
                    <strong>{planet.name}</strong>
                    <small>{planet.nameEn}</small>
                  </div>
                </article>
              ) : null;
            })}
          </div>
        </div>
      )}

      {!!recipe?.inputs.length && (
        <div className="pi-dependency-children">
          {recipe.inputs.map((input) => {
            const inputCommodity = commodityById.get(input.id);
            if (!inputCommodity) return null;
            const inputQuantity = input.quantity * runs;
            const childRuns = inputCommodity.recipe
              ? inputQuantity / Math.max(1, inputCommodity.recipe.outputQuantity)
              : 1;
            return (
              <PlanetaryDependencyBranch
                key={`${commodity.id}-${input.id}`}
                commodity={inputCommodity}
                requiredQuantity={inputQuantity}
                runs={childRuns}
                commodityById={commodityById}
                planetById={planetById}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<ProductionData | null>(null);
  const [workspaceStateReady, setWorkspaceStateReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [oreQuery, setOreQuery] = useState('');
  const [mineralQuery, setMineralQuery] = useState('');
  const [blueprintQuery, setBlueprintQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [planetaryQuery, setPlanetaryQuery] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [activity, setActivity] = useState<'all' | 'manufacturing' | 'reaction'>('all');
  const [catalogActivity, setCatalogActivity] = useState<'all' | 'manufacturing' | 'reaction'>('all');
  const [catalogKind, setCatalogKind] = useState<BlueprintKind>('all');
  const [catalogGroup, setCatalogGroup] = useState('all');
  const [planetaryTier, setPlanetaryTier] = useState<'all' | PlanetaryTier>('all');
  const [skillGroup, setSkillGroup] = useState('all');
  const [skillTargetLevel, setSkillTargetLevel] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [blueprintTreeMode, setBlueprintTreeMode] = useState<BlueprintTreeMode>('materials');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chain');
  const [selectedOreId, setSelectedOreId] = useState<number | null>(null);
  const [selectedMineralId, setSelectedMineralId] = useState<number | null>(null);
  const [sourceMineralId, setSourceMineralId] = useState<number | null>(null);
  const [dependencyBlueprintId, setDependencyBlueprintId] = useState<number | null>(null);
  const [blueprintHistory, setBlueprintHistory] = useState<BlueprintHistoryEntry[]>([]);
  const [selectedPlanetaryId, setSelectedPlanetaryId] = useState<number | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [skillHistory, setSkillHistory] = useState<SkillHistoryEntry[]>([]);
  const [selectedProductCharacteristics, setSelectedProductCharacteristics] = useState<ProductCharacteristics | null>(null);
  const [characteristicsLoading, setCharacteristicsLoading] = useState(false);
  const [characteristicsError, setCharacteristicsError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [catalogVisibleCount, setCatalogVisibleCount] = useState(BLUEPRINT_PAGE_SIZE);
  const [skillVisibleCount, setSkillVisibleCount] = useState(SKILL_PAGE_SIZE);

  useEffect(() => {
    fetch('/eve-production-data.json')
      .then((response) => {
        if (!response.ok) throw new Error('Data request failed');
        return response.json() as Promise<ProductionData>;
      })
      .then((payload) => {
        let saved: SavedWorkspaceState = {};
        try {
          saved = JSON.parse(window.localStorage.getItem(WORKSPACE_STATE_KEY) ?? '{}') as SavedWorkspaceState;
        } catch {
          saved = {};
        }

        setData(payload);
        const initialOre = payload.ores.find((ore) => ore.id === saved.selectedOreId)
          ?? payload.ores.find((ore) => ore.name === 'Veldspar')
          ?? payload.ores[0];
        const initialMineral = initialOre?.minerals.find((mineral) => mineral.id === saved.selectedMineralId)
          ?? initialOre?.minerals[0];
        const initialSourceMineral = payload.minerals.find((mineral) => mineral.id === saved.sourceMineralId)
          ?? payload.minerals.find((mineral) => mineral.name === 'Tritanium')
          ?? payload.minerals[0];
        const initialBlueprint = payload.blueprints.find((blueprint) => blueprint.id === saved.dependencyBlueprintId);
        const validBlueprintIds = new Set(payload.blueprints.map((blueprint) => blueprint.id));
        const initialSkill = payload.skills.find((skill) => skill.id === saved.selectedSkillId)
          ?? payload.skills.find((skill) => skill.name === 'Industry')
          ?? payload.skills[0];
        const validSkillIds = new Set(payload.skills.map((skill) => skill.id));
        const initialBlueprintHistory = Array.isArray(saved.blueprintHistory)
          ? saved.blueprintHistory
            .flatMap((entry): BlueprintHistoryEntry[] => {
              if (Number.isInteger(entry) && validBlueprintIds.has(entry as number)) {
                return [{
                  blueprintId: entry as number,
                  catalogQuery: '',
                  catalogActivity: 'all',
                  catalogKind: 'all',
                  catalogGroup: 'all',
                }];
              }
              if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.blueprintId)
                || !validBlueprintIds.has(entry.blueprintId)) return [];
              const restoredKind = entry.catalogKind === 'all'
                || (typeof entry.catalogKind === 'string' && entry.catalogKind in blueprintKindLabels)
                ? entry.catalogKind as BlueprintKind
                : 'all';
              const restoredActivity = entry.catalogActivity === 'manufacturing' || entry.catalogActivity === 'reaction'
                ? entry.catalogActivity
                : 'all';
              return [{
                blueprintId: entry.blueprintId,
                catalogQuery: typeof entry.catalogQuery === 'string' ? entry.catalogQuery : '',
                catalogActivity: restoredActivity,
                catalogKind: restoredKind,
                catalogGroup: typeof entry.catalogGroup === 'string' ? entry.catalogGroup : 'all',
              }];
            })
            .slice(-25)
          : [];
        const initialSkillHistory = Array.isArray(saved.skillHistory)
          ? saved.skillHistory
            .flatMap((entry): SkillHistoryEntry[] => {
              if (Number.isInteger(entry) && validSkillIds.has(entry as number)) {
                return [{ skillId: entry as number, skillQuery: '', skillGroup: 'all' }];
              }
              if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.skillId)
                || !validSkillIds.has(entry.skillId)) return [];
              return [{
                skillId: entry.skillId,
                skillQuery: typeof entry.skillQuery === 'string' ? entry.skillQuery : '',
                skillGroup: typeof entry.skillGroup === 'string' ? entry.skillGroup : 'all',
              }];
            })
            .slice(-25)
          : [];
        const initialPlanetaryCommodity = payload.planetary.commodities.find(
          (commodity) => commodity.id === saved.selectedPlanetaryId,
        ) ?? payload.planetary.commodities.find((commodity) => commodity.name === 'Broadcast Node')
          ?? payload.planetary.commodities[0];

        if (saved.activeTab && activeTabs.has(saved.activeTab)) setActiveTab(saved.activeTab);
        if (typeof saved.oreQuery === 'string') setOreQuery(saved.oreQuery);
        if (typeof saved.mineralQuery === 'string') setMineralQuery(saved.mineralQuery);
        if (typeof saved.blueprintQuery === 'string') setBlueprintQuery(saved.blueprintQuery);
        if (typeof saved.catalogQuery === 'string') setCatalogQuery(saved.catalogQuery);
        if (typeof saved.planetaryQuery === 'string') setPlanetaryQuery(saved.planetaryQuery);
        if (typeof saved.skillQuery === 'string') setSkillQuery(saved.skillQuery);
        if (saved.activity === 'all' || saved.activity === 'manufacturing' || saved.activity === 'reaction') {
          setActivity(saved.activity);
        }
        if (saved.catalogActivity === 'all' || saved.catalogActivity === 'manufacturing' || saved.catalogActivity === 'reaction') {
          setCatalogActivity(saved.catalogActivity);
        }
        if (saved.catalogKind === 'all' || (saved.catalogKind && saved.catalogKind in blueprintKindLabels)) {
          setCatalogKind(saved.catalogKind);
        }
        if (typeof saved.catalogGroup === 'string') setCatalogGroup(saved.catalogGroup);
        if (saved.planetaryTier === 'all' || saved.planetaryTier === 'P0' || saved.planetaryTier === 'P1'
          || saved.planetaryTier === 'P2' || saved.planetaryTier === 'P3' || saved.planetaryTier === 'P4') {
          setPlanetaryTier(saved.planetaryTier);
        }
        if (typeof saved.skillGroup === 'string') setSkillGroup(saved.skillGroup);
        if (saved.skillTargetLevel && saved.skillTargetLevel >= 1 && saved.skillTargetLevel <= 5) {
          setSkillTargetLevel(saved.skillTargetLevel);
        }
        if (saved.blueprintTreeMode === 'materials' || saved.blueprintTreeMode === 'skills') {
          setBlueprintTreeMode(saved.blueprintTreeMode);
        }
        setSelectedOreId(initialOre?.id ?? null);
        setSelectedMineralId(initialMineral?.id ?? null);
        setSourceMineralId(initialSourceMineral?.id ?? null);
        setDependencyBlueprintId(initialBlueprint?.id ?? null);
        setBlueprintHistory(initialBlueprintHistory);
        setSelectedPlanetaryId(initialPlanetaryCommodity?.id ?? null);
        setSelectedSkillId(initialSkill?.id ?? null);
        setSkillHistory(initialSkillHistory);
        setWorkspaceStateReady(true);
      })
      .catch(() => setLoadError(true));
  }, []);

  const selectedOre = useMemo(
    () => data?.ores.find((ore) => ore.id === selectedOreId) ?? null,
    [data, selectedOreId],
  );
  const selectedMineral = useMemo(
    () => data?.minerals.find((mineral) => mineral.id === selectedMineralId) ?? null,
    [data, selectedMineralId],
  );
  const sourceMineral = useMemo(
    () => data?.minerals.find((mineral) => mineral.id === sourceMineralId) ?? null,
    [data, sourceMineralId],
  );
  const selectedDependencyBlueprint = useMemo(
    () => data?.blueprints.find((blueprint) => blueprint.id === dependencyBlueprintId) ?? null,
    [data, dependencyBlueprintId],
  );
  const selectedDependencyProductId = selectedDependencyBlueprint?.products[0]?.id;
  const previousDependencyBlueprint = useMemo(() => {
    const previousId = blueprintHistory.at(-1)?.blueprintId;
    return data?.blueprints.find((blueprint) => blueprint.id === previousId) ?? null;
  }, [blueprintHistory, data]);
  const selectedPlanetaryCommodity = useMemo(
    () => data?.planetary.commodities.find((commodity) => commodity.id === selectedPlanetaryId) ?? null,
    [data, selectedPlanetaryId],
  );
  const selectedSkill = useMemo(
    () => data?.skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [data, selectedSkillId],
  );
  const previousSkill = useMemo(() => {
    const previousId = skillHistory.at(-1)?.skillId;
    return data?.skills.find((skill) => skill.id === previousId) ?? null;
  }, [data, skillHistory]);
  const filteredOres = useMemo(() => {
    if (!data) return [];
    const query = oreQuery.trim().toLocaleLowerCase('ru');
    if (!query) return data.ores;
    return data.ores.filter((ore) =>
      [ore.name, ore.family, ore.kind, ore.grade].some((value) =>
        value.toLocaleLowerCase('ru').includes(query),
      ),
    );
  }, [data, oreQuery]);
  const filteredBlueprints = useMemo(() => {
    if (!selectedMineral) return [];
    const query = blueprintQuery.trim().toLocaleLowerCase('ru');
    return selectedMineral.blueprints.filter((blueprint) => {
      if (activity !== 'all' && blueprint.activity !== activity) return false;
      if (!query) return true;
      return [
        blueprint.blueprintName,
        ...blueprint.products.flatMap((product) => [product.name, product.group, product.category]),
      ].some((value) => value.toLocaleLowerCase('ru').includes(query));
    });
  }, [activity, blueprintQuery, selectedMineral]);
  const filteredMinerals = useMemo(() => {
    if (!data) return [];
    const query = mineralQuery.trim().toLocaleLowerCase('ru');
    return data.minerals
      .filter((mineral) => !query || mineral.name.toLocaleLowerCase('ru').includes(query))
      .sort((left, right) =>
        mineralOriginRank(data.ores, left.id) - mineralOriginRank(data.ores, right.id)
        || left.id - right.id,
      );
  }, [data, mineralQuery]);
  const sourceOres = useMemo(() => {
    if (!data || !sourceMineral) return [];
    const kindOrder = (kind: string) => {
      if (kind === 'Астероидная') return 0;
      if (kind.startsWith('Лунная')) return 1;
      if (kind === 'Лёд') return 2;
      return 3;
    };
    return data.ores
      .flatMap((ore) => {
        const mineral = ore.minerals.find((item) => item.id === sourceMineral.id);
        return mineral ? [{ ore, mineral }] : [];
      })
      .sort((left, right) =>
        kindOrder(left.ore.kind) - kindOrder(right.ore.kind)
        || left.ore.kind.localeCompare(right.ore.kind, 'ru')
        || left.ore.name.localeCompare(right.ore.name, 'en'),
      );
  }, [data, sourceMineral]);
  const filteredCatalogBlueprints = useMemo(() => {
    if (!data) return [];
    const query = catalogQuery.trim().toLocaleLowerCase('ru');
    return data.blueprints.filter((blueprint) => {
      if (catalogActivity !== 'all' && blueprint.activity !== catalogActivity) return false;
      if (catalogKind !== 'all' && blueprintKind(blueprint.products[0]) !== catalogKind) return false;
      if (catalogGroup !== 'all' && blueprint.products[0]?.group !== catalogGroup) return false;
      if (!query) return true;
      return [
        blueprint.name,
        ...blueprint.products.flatMap((product) => [product.name, product.group, product.category]),
      ].some((value) => value.toLocaleLowerCase('ru').includes(query));
    });
  }, [catalogActivity, catalogGroup, catalogKind, catalogQuery, data]);
  const catalogGroupOptions = useMemo(() => {
    if (!data || catalogKind === 'all') return [];
    const options = new Map<string, { label: string; count: number }>();
    for (const blueprint of data.blueprints) {
      const product = blueprint.products[0];
      if (!product || blueprintKind(product) !== catalogKind) continue;
      const current = options.get(product.group);
      if (current) {
        current.count += 1;
      } else {
        options.set(product.group, { label: product.groupRu || product.group, count: 1 });
      }
    }
    return [...options.entries()]
      .map(([value, option]) => ({ value, ...option }))
      .sort((left, right) => left.label.localeCompare(right.label, 'ru') || left.value.localeCompare(right.value, 'en'));
  }, [catalogKind, data]);
  const filteredPlanetaryCommodities = useMemo(() => {
    if (!data) return [];
    const query = planetaryQuery.trim().toLocaleLowerCase('ru');
    const rank: Record<PlanetaryTier, number> = { P4: 0, P3: 1, P2: 2, P1: 3, P0: 4 };
    return data.planetary.commodities
      .filter((commodity) => planetaryTier === 'all' || commodity.tier === planetaryTier)
      .filter((commodity) => !query || commodity.name.toLocaleLowerCase('ru').includes(query))
      .sort((left, right) => rank[left.tier] - rank[right.tier] || left.name.localeCompare(right.name, 'en'));
  }, [data, planetaryQuery, planetaryTier]);
  const skillGroupOptions = useMemo(() => {
    const groups = new Map<number, { value: string; label: string; count: number }>();
    for (const skill of data?.skills ?? []) {
      const current = groups.get(skill.groupId);
      if (current) {
        current.count += 1;
      } else {
        groups.set(skill.groupId, { value: skill.group, label: skill.groupRu, count: 1 });
      }
    }
    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label, 'ru'));
  }, [data]);
  const filteredSkills = useMemo(() => {
    const query = skillQuery.trim().toLocaleLowerCase('ru');
    return (data?.skills ?? []).filter((skill) => {
      if (skillGroup !== 'all' && skill.group !== skillGroup) return false;
      if (!query) return true;
      return [skill.name, skill.group, skill.groupRu, skill.description]
        .some((value) => value.toLocaleLowerCase('ru').includes(query));
    });
  }, [data, skillGroup, skillQuery]);
  const skillById = useMemo(
    () => new Map((data?.skills ?? []).map((skill) => [skill.id, skill])),
    [data],
  );
  const blueprintSkillEstimate = useMemo(() => {
    if (!selectedDependencyBlueprint) return null;
    const requiredLevels = new Map<number, number>();
    for (const requirement of selectedDependencyBlueprint.skills) {
      requiredLevels.set(
        requirement.id,
        Math.max(requiredLevels.get(requirement.id) ?? 0, requirement.level),
      );
      const skill = skillById.get(requirement.id);
      if (skill) {
        collectSkillPrerequisites(
          skill,
          skillById,
          requiredLevels,
          new Set<number>([skill.id]),
        );
      }
    }
    const knownRequirements = [...requiredLevels.entries()].flatMap(([skillId, level]) => {
      const skill = skillById.get(skillId);
      return skill ? [{ skill, level }] : [];
    });
    return {
      directCount: selectedDependencyBlueprint.skills.length,
      totalCount: requiredLevels.size,
      totalSkillPoints: knownRequirements.reduce(
        (sum, item) => sum + skillPointsToLevel(item.skill.rank, item.level),
        0,
      ),
      totalSeconds: knownRequirements.reduce(
        (sum, item) => sum + omegaTrainingSeconds(item.skill, item.level),
        0,
      ),
    };
  }, [selectedDependencyBlueprint, skillById]);
  const skillTrainingEstimate = useMemo(() => {
    if (!selectedSkill) return null;
    const requiredLevels = new Map<number, number>();
    collectSkillPrerequisites(
      selectedSkill,
      skillById,
      requiredLevels,
      new Set<number>([selectedSkill.id]),
    );
    requiredLevels.delete(selectedSkill.id);
    const prerequisites = [...requiredLevels.entries()].flatMap(([skillId, level]) => {
      const skill = skillById.get(skillId);
      return skill ? [{ skill, level }] : [];
    });
    const prerequisiteSkillPoints = prerequisites.reduce(
      (sum, item) => sum + skillPointsToLevel(item.skill.rank, item.level),
      0,
    );
    const prerequisiteSeconds = prerequisites.reduce(
      (sum, item) => sum + omegaTrainingSeconds(item.skill, item.level),
      0,
    );
    const selectedSkillPoints = skillPointsToLevel(selectedSkill.rank, skillTargetLevel);
    const selectedSeconds = omegaTrainingSeconds(selectedSkill, skillTargetLevel);
    return {
      prerequisiteCount: prerequisites.length,
      prerequisiteSkillPoints,
      prerequisiteSeconds,
      selectedSkillPoints,
      selectedSeconds,
      totalSkillPoints: prerequisiteSkillPoints + selectedSkillPoints,
      totalSeconds: prerequisiteSeconds + selectedSeconds,
    };
  }, [selectedSkill, skillById, skillTargetLevel]);
  const mineralById = useMemo(
    () => new Map((data?.minerals ?? []).map((mineral) => [mineral.id, mineral])),
    [data],
  );
  const producersByProductId = useMemo(() => {
    const result = new Map<number, BlueprintProducer[]>();
    for (const blueprint of data?.blueprints ?? []) {
      for (const product of blueprint.products) {
        const current = result.get(product.id) ?? [];
        current.push({ blueprint, product });
        result.set(product.id, current);
      }
    }
    return result;
  }, [data]);
  const oreSourcesByMineralId = useMemo(() => {
    const result = new Map<number, Array<{ ore: Ore; mineral: MineralYield }>>();
    for (const ore of data?.ores ?? []) {
      for (const mineral of ore.minerals) {
        const current = result.get(mineral.id) ?? [];
        current.push({ ore, mineral });
        result.set(mineral.id, current);
      }
    }
    const kindOrder = (kind: string) => kind === 'Астероидная' ? 0 : kind.startsWith('Лунная') ? 1 : kind === 'Лёд' ? 2 : 3;
    for (const sources of result.values()) {
      sources.sort((left, right) =>
        kindOrder(left.ore.kind) - kindOrder(right.ore.kind)
        || left.ore.id - right.ore.id,
      );
    }
    return result;
  }, [data]);
  const planetaryCommodityById = useMemo(
    () => new Map((data?.planetary.commodities ?? []).map((commodity) => [commodity.id, commodity])),
    [data],
  );
  const planetById = useMemo(
    () => new Map((data?.planetary.planets ?? []).map((planet) => [planet.id, planet])),
    [data],
  );
  const productionTimeEstimate = useMemo(() => {
    if (!selectedDependencyBlueprint) return null;
    return estimateBlueprintProductionTime(
      selectedDependencyBlueprint,
      1,
      producersByProductId,
    );
  }, [producersByProductId, selectedDependencyBlueprint]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [selectedMineralId, activity, blueprintQuery]);
  useEffect(() => setCatalogVisibleCount(BLUEPRINT_PAGE_SIZE), [catalogActivity, catalogGroup, catalogKind, catalogQuery]);
  useEffect(() => setSkillVisibleCount(SKILL_PAGE_SIZE), [skillGroup, skillQuery]);

  useEffect(() => {
    if (catalogGroup === 'all') return;
    if (!catalogGroupOptions.some((option) => option.value === catalogGroup)) setCatalogGroup('all');
  }, [catalogGroup, catalogGroupOptions]);

  useEffect(() => {
    if (skillGroup === 'all') return;
    if (!skillGroupOptions.some((option) => option.value === skillGroup)) setSkillGroup('all');
  }, [skillGroup, skillGroupOptions]);

  useEffect(() => {
    if (selectedDependencyProductId === undefined) {
      setSelectedProductCharacteristics(null);
      setCharacteristicsLoading(false);
      setCharacteristicsError(false);
      return;
    }

    let cancelled = false;
    setSelectedProductCharacteristics(null);
    setCharacteristicsLoading(true);
    setCharacteristicsError(false);
    loadProductCharacteristics(selectedDependencyProductId)
      .then((result) => {
        if (cancelled) return;
        setSelectedProductCharacteristics(result);
        setCharacteristicsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedProductCharacteristics(null);
        setCharacteristicsLoading(false);
        setCharacteristicsError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDependencyProductId]);

  useEffect(() => {
    if (!data || !workspaceStateReady) return;
    const state: SavedWorkspaceState = {
      activeTab,
      oreQuery,
      mineralQuery,
      blueprintQuery,
      catalogQuery,
      planetaryQuery,
      skillQuery,
      activity,
      catalogActivity,
      catalogKind,
      catalogGroup,
      planetaryTier,
      skillGroup,
      skillTargetLevel,
      blueprintTreeMode,
      blueprintHistory,
      skillHistory,
      selectedOreId,
      selectedMineralId,
      sourceMineralId,
      dependencyBlueprintId,
      selectedPlanetaryId,
      selectedSkillId,
    };
    try {
      window.localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(state));
    } catch {
      // The interface remains usable when browser storage is unavailable.
    }
  }, [
    activeTab,
    activity,
    blueprintQuery,
    blueprintHistory,
    blueprintTreeMode,
    catalogActivity,
    catalogGroup,
    catalogKind,
    catalogQuery,
    data,
    dependencyBlueprintId,
    mineralQuery,
    oreQuery,
    planetaryQuery,
    planetaryTier,
    selectedSkillId,
    selectedMineralId,
    selectedOreId,
    selectedPlanetaryId,
    sourceMineralId,
    skillGroup,
    skillHistory,
    skillQuery,
    skillTargetLevel,
    workspaceStateReady,
  ]);

  useEffect(() => {
    if (activeTab !== 'chain' || selectedOreId === null) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-ore-id="${selectedOreId}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, selectedOreId]);

  useEffect(() => {
    if (activeTab !== 'blueprints' || dependencyBlueprintId === null) return;
    const selectedIndex = filteredCatalogBlueprints.findIndex((blueprint) => blueprint.id === dependencyBlueprintId);
    const requiredCount = selectedIndex >= 0
      ? Math.ceil((selectedIndex + 1) / BLUEPRINT_PAGE_SIZE) * BLUEPRINT_PAGE_SIZE
      : BLUEPRINT_PAGE_SIZE;
    if (catalogVisibleCount < requiredCount) {
      setCatalogVisibleCount(requiredCount);
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.dependency-canvas-scroll')?.scrollTo({ top: 0, left: 0 });
      document
        .querySelector<HTMLElement>(`[data-blueprint-id="${dependencyBlueprintId}"]`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, catalogVisibleCount, dependencyBlueprintId, filteredCatalogBlueprints]);

  useEffect(() => {
    if (activeTab !== 'skills' || selectedSkillId === null) return;
    const selectedIndex = filteredSkills.findIndex((skill) => skill.id === selectedSkillId);
    const requiredCount = selectedIndex >= 0
      ? Math.ceil((selectedIndex + 1) / SKILL_PAGE_SIZE) * SKILL_PAGE_SIZE
      : SKILL_PAGE_SIZE;
    if (skillVisibleCount < requiredCount) {
      setSkillVisibleCount(requiredCount);
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.skill-dependency-scroll')?.scrollTo({ top: 0, left: 0 });
      document
        .querySelector<HTMLElement>(`[data-skill-id="${selectedSkillId}"]`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, filteredSkills, selectedSkillId, skillVisibleCount]);

  useEffect(() => {
    if (!data) return;
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: 'show_production_chain',
        title: 'Показать производственную цепочку',
        description: 'Выбирает руду или лёд и, при необходимости, один из продуктов переработки в дереве EVE Online.',
        inputSchema: {
          type: 'object',
          properties: {
            ore: { type: 'string', description: 'Полное или частичное название руды или льда.' },
            mineral: { type: 'string', description: 'Необязательное полное или частичное название продукта переработки.' },
          },
          required: ['ore'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object') throw new Error('Нужно указать название руды или льда.');
          const { ore, mineral } = input as { ore?: unknown; mineral?: unknown };
          if (typeof ore !== 'string' || !ore.trim()) throw new Error('Название руды или льда должно быть непустой строкой.');
          if (mineral !== undefined && typeof mineral !== 'string') throw new Error('Название продукта переработки должно быть строкой.');
          const oreNeedle = ore.trim().toLocaleLowerCase('ru');
          const match = data.ores.find((item) => item.name.toLocaleLowerCase('ru') === oreNeedle)
            ?? data.ores.find((item) => item.name.toLocaleLowerCase('ru').includes(oreNeedle));
          if (!match) throw new Error(`Руда «${ore}» не найдена.`);
          let mineralMatch: MineralYield | undefined = match.minerals[0];
          if (typeof mineral === 'string' && mineral.trim()) {
            const mineralNeedle = mineral.trim().toLocaleLowerCase('ru');
            mineralMatch = match.minerals.find((item) => item.name.toLocaleLowerCase('ru') === mineralNeedle)
              ?? match.minerals.find((item) => item.name.toLocaleLowerCase('ru').includes(mineralNeedle));
            if (!mineralMatch) throw new Error(`Минерал «${mineral}» не получается из ${match.name}.`);
          }
          setOreQuery('');
          setBlueprintQuery('');
          setActivity('all');
          setActiveTab('chain');
          setSelectedOreId(match.id);
          setSelectedMineralId(mineralMatch?.id ?? null);
          return {
            ore: match.name,
            mineral: mineralMatch?.name ?? null,
            mineralCount: match.minerals.length,
            blueprintCount: mineralMatch
              ? data.minerals.find((item) => item.id === mineralMatch.id)?.blueprints.length ?? 0
              : 0,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    const sourceRegistration = context.registerTool(
      {
        name: 'show_mineral_sources',
        title: 'Показать источники материала',
        description: 'Открывает вкладку источников и показывает всю руду или лёд, из которых получается указанный материал EVE Online.',
        inputSchema: {
          type: 'object',
          properties: {
            mineral: { type: 'string', description: 'Полное или частичное название минерала или продукта льда.' },
          },
          required: ['mineral'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object') throw new Error('Нужно указать название минерала или продукта льда.');
          const { mineral } = input as { mineral?: unknown };
          if (typeof mineral !== 'string' || !mineral.trim()) {
            throw new Error('Название минерала или продукта льда должно быть непустой строкой.');
          }
          const needle = mineral.trim().toLocaleLowerCase('ru');
          const match = data.minerals.find((item) => item.name.toLocaleLowerCase('ru') === needle)
            ?? data.minerals.find((item) => item.name.toLocaleLowerCase('ru').includes(needle));
          if (!match) throw new Error(`Минерал «${mineral}» не найден.`);
          const oreCount = data.ores.filter((ore) => ore.minerals.some((item) => item.id === match.id)).length;
          setMineralQuery('');
          setSourceMineralId(match.id);
          setActiveTab('sources');
          return { mineral: match.name, oreCount };
        },
      },
      { signal: lifecycle.signal },
    );
    Promise.all([registration, sourceRegistration].map((item) => Promise.resolve(item))).catch(() => undefined);
    return () => lifecycle.abort();
  }, [data]);

  function selectOre(ore: Ore) {
    setSelectedOreId(ore.id);
    setSelectedMineralId(ore.minerals[0]?.id ?? null);
    setBlueprintQuery('');
    setActivity('all');
  }

  function openSourceOre(ore: Ore, mineral: MineralYield) {
    setOreQuery('');
    setBlueprintQuery('');
    setActivity('all');
    setSelectedOreId(ore.id);
    setSelectedMineralId(mineral.id);
    setActiveTab('chain');
  }

  function selectNestedBlueprint(blueprintId: number) {
    const nestedBlueprint = data?.blueprints.find((blueprint) => blueprint.id === blueprintId);
    if (dependencyBlueprintId !== null && dependencyBlueprintId !== blueprintId) {
      setBlueprintHistory((history) => [...history, {
        blueprintId: dependencyBlueprintId,
        catalogQuery,
        catalogActivity,
        catalogKind,
        catalogGroup,
      }].slice(-25));
    }
    setCatalogQuery('');
    const nestedProduct = nestedBlueprint?.products[0];
    setCatalogKind(nestedProduct ? blueprintKind(nestedProduct) : 'all');
    setCatalogGroup(nestedProduct?.group ?? 'all');
    setCatalogActivity('all');
    setDependencyBlueprintId(blueprintId);
  }

  function selectCatalogBlueprint(blueprintId: number) {
    setBlueprintHistory([]);
    setDependencyBlueprintId(blueprintId);
  }

  function returnToPreviousBlueprint() {
    const previous = blueprintHistory.at(-1);
    if (!previous) return;
    setBlueprintHistory((history) => history.slice(0, -1));
    setCatalogQuery(previous.catalogQuery);
    setCatalogActivity(previous.catalogActivity);
    setCatalogKind(previous.catalogKind);
    setCatalogGroup(previous.catalogGroup);
    setDependencyBlueprintId(previous.blueprintId);
  }

  function openBlueprintSkill(skillId: number) {
    const skill = data?.skills.find((item) => item.id === skillId);
    if (!skill) return;
    setSkillHistory([]);
    setSkillQuery('');
    setSkillGroup(skill.group);
    setSelectedSkillId(skill.id);
    setActiveTab('skills');
  }

  function selectNestedSkill(skillId: number) {
    const nestedSkill = data?.skills.find((skill) => skill.id === skillId);
    if (selectedSkillId !== null && selectedSkillId !== skillId) {
      setSkillHistory((history) => [...history, {
        skillId: selectedSkillId,
        skillQuery,
        skillGroup,
      }].slice(-25));
    }
    setSkillQuery('');
    setSkillGroup(nestedSkill?.group ?? 'all');
    setSelectedSkillId(skillId);
  }

  function selectCatalogSkill(skillId: number) {
    setSkillHistory([]);
    setSelectedSkillId(skillId);
  }

  function returnToPreviousSkill() {
    const previous = skillHistory.at(-1);
    if (!previous) return;
    setSkillHistory((history) => history.slice(0, -1));
    setSkillQuery(previous.skillQuery);
    setSkillGroup(previous.skillGroup);
    setSelectedSkillId(previous.skillId);
  }

  if (loadError) {
    return (
      <main className="status-screen">
        <Boxes aria-hidden="true" />
        <h1>Не удалось загрузить справочник</h1>
        <p>Обновите страницу и попробуйте ещё раз.</p>
      </main>
    );
  }

  if (!data || !selectedOre) {
    return (
      <main className="status-screen">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Загружаю дерево производства…</p>
      </main>
    );
  }

  const releaseDate = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(data.meta.releaseDate));
  const selectedDependencyProduct = selectedDependencyBlueprint?.products[0];
  const selectedDependencyIsPlanetary = blueprintKind(selectedDependencyProduct) === 'planetary';
  const finalBlueprintSeconds = Math.max(0, selectedDependencyBlueprint?.time ?? 0);
  const componentSequentialSeconds = Math.max(
    0,
    (productionTimeEstimate?.sequentialSeconds ?? 0) - finalBlueprintSeconds,
  );
  const componentParallelSeconds = Math.max(
    0,
    (productionTimeEstimate?.parallelSeconds ?? 0) - finalBlueprintSeconds,
  );
  const selectedProductCharacteristicCount = selectedProductCharacteristics?.groups.reduce(
    (sum, group) => sum + group.attributes.length,
    0,
  ) ?? 0;

  return (
    <main className="app-shell">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ActiveTab)}
        className="site-tabs"
      >
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <Boxes />
        </div>
        <div className="brand-copy">
          <h1>Дерево производства</h1>
          <p>EVE Online · SDE {releaseDate}</p>
        </div>
        <TabsList className="topbar-tabs" aria-label="Разделы справочника">
          <TabsTrigger value="chain"><Factory /><span className="tab-label-long">Руда → чертежи</span><span className="tab-label-short">Руда</span></TabsTrigger>
          <TabsTrigger value="sources"><Pickaxe /><span className="tab-label-long">Минерал → руда</span><span className="tab-label-short">Минералы</span></TabsTrigger>
          <TabsTrigger value="planetary"><Orbit /><span className="tab-label-long">Планетарка</span><span className="tab-label-short">PI</span></TabsTrigger>
          <TabsTrigger value="skills"><BookOpen /><span>Навыки</span></TabsTrigger>
          <TabsTrigger value="blueprints"><FileText /><span>Чертежи</span></TabsTrigger>
          <TabsTrigger value="fitting"><Wrench /><span>Фиты</span></TabsTrigger>
        </TabsList>
        <div className="dataset-stats">
          <span><b>{data.meta.oreCount}</b> видов руды и льда</span>
          <span><b>{data.meta.mineralCount}</b> материалов</span>
          <span><b>{numberFormat.format(data.meta.uniqueBlueprintActivities)}</b> чертежей</span>
          <span><b>{numberFormat.format(data.meta.skillCount)}</b> навыков</span>
        </div>
      </header>

      <TabsContent value="chain" className="tab-canvas">
      <div className="production-grid">
        <section className="tree-panel ore-panel" aria-labelledby="ore-title">
          <div className="panel-head">
            <div>
              <span className="step-number">01</span>
              <h2 id="ore-title">Руда и лёд</h2>
            </div>
            <span className="result-count">{filteredOres.length}</span>
          </div>
          <label className="search-box">
            <Search aria-hidden="true" />
            <Input
              value={oreQuery}
              onChange={(event) => setOreQuery(event.target.value)}
              placeholder="Название руды или льда"
              aria-label="Поиск руды или льда"
            />
          </label>
          <div className="ore-list" role="listbox" aria-label="Виды руды и льда">
            {filteredOres.map((ore) => (
              <button
                type="button"
                role="option"
                aria-selected={ore.id === selectedOreId}
                className="ore-row"
                data-ore-id={ore.id}
                key={ore.id}
                onClick={() => selectOre(ore)}
              >
                <img src={iconUrl(ore.id)} alt="" />
                <span className="ore-copy">
                  <strong>{ore.name}</strong>
                  <small>{ore.kind} · {ore.grade}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
            {!filteredOres.length && <p className="empty-note">Ничего не найдено</p>}
          </div>
        </section>

        <section className="tree-panel mineral-panel" aria-labelledby="mineral-title">
          <div className="panel-head">
            <div>
              <span className="step-number">02</span>
              <h2 id="mineral-title">Минералы и продукты льда</h2>
            </div>
            <span className="result-count">{selectedOre.minerals.length}</span>
          </div>

          <article className="selected-ore-card">
            <img src={iconUrl(selectedOre.id)} alt="" />
            <div>
              <span className="eyebrow">Выбрано</span>
              <h3>{selectedOre.name}</h3>
              <p>{numberFormat.format(selectedOre.portion)} ед. в партии · {selectedOre.volume} м³/ед.</p>
            </div>
          </article>

          <div className="branch-label"><span />Выход после переработки<span /></div>
          <div className="mineral-list">
            {selectedOre.minerals.map((mineral) => {
              const reference = data.minerals.find((item) => item.id === mineral.id);
              return (
                <button
                  type="button"
                  className="mineral-card"
                  aria-pressed={mineral.id === selectedMineralId}
                  key={mineral.id}
                  onClick={() => setSelectedMineralId(mineral.id)}
                >
                  <span className="node-port" aria-hidden="true" />
                  <img src={iconUrl(mineral.id)} alt="" />
                  <span className="mineral-copy">
                    <strong>{mineral.name}</strong>
                    <small>{reference ? compactFormat.format(reference.blueprints.length) : 0} чертежей</small>
                  </span>
                  <span className="yield-value">
                    <b>{yieldLabel(mineral)}</b>
                    <small>{mineral.random ? 'случайно' : 'ед.'}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="tree-panel blueprint-panel" aria-labelledby="blueprint-title">
          <div className="blueprint-head">
            <div className="panel-head">
              <div>
                <span className="step-number">03</span>
                <h2 id="blueprint-title">Чертежи</h2>
              </div>
              <span className="result-count">{numberFormat.format(filteredBlueprints.length)}</span>
            </div>

            {selectedMineral && (
              <div className="selected-mineral">
                <img src={iconUrl(selectedMineral.id)} alt="" />
                <div>
                  <span className="eyebrow">Используют материал</span>
                  <h3>{selectedMineral.name}</h3>
                </div>
                <Badge variant="outline">ID {selectedMineral.id}</Badge>
              </div>
            )}

            <div className="blueprint-controls">
              <label className="search-box">
                <Search aria-hidden="true" />
                <Input
                  value={blueprintQuery}
                  onChange={(event) => setBlueprintQuery(event.target.value)}
                  placeholder="Предмет, чертёж или группа"
                  aria-label="Поиск чертежей"
                />
              </label>
              <NativeSelect
                value={activity}
                onChange={(event) => setActivity(event.target.value as typeof activity)}
                aria-label="Тип производства"
              >
                <NativeSelectOption value="all">Все операции</NativeSelectOption>
                <NativeSelectOption value="manufacturing">Производство</NativeSelectOption>
                <NativeSelectOption value="reaction">Реакции</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          <div className="blueprint-list">
            {filteredBlueprints.slice(0, visibleCount).map((blueprint) => {
              const product = blueprint.products[0];
              return (
                <article className="blueprint-row" key={`${blueprint.activity}-${blueprint.blueprintId}`}>
                  <img
                    className="product-icon"
                    src={productIconUrl(product.id)}
                    alt=""
                    loading="lazy"
                  />
                  <div className="blueprint-copy">
                    <div className="blueprint-name-line">
                      <h3>{product.name}</h3>
                      {product.quantity > 1 && <span>× {numberFormat.format(product.quantity)}</span>}
                    </div>
                    <p>{blueprint.blueprintName}</p>
                    <div className="blueprint-meta">
                      <span>{product.group}</span>
                      <span>·</span>
                      <span>{formatDuration(blueprint.time)}</span>
                      {blueprint.products.length > 1 && <span>· +{blueprint.products.length - 1} продукт</span>}
                    </div>
                    {blueprint.description && (
                      <details className="blueprint-description">
                        <summary>Описание</summary>
                        <p>{blueprint.description}</p>
                      </details>
                    )}
                  </div>
                  <div className="blueprint-usage">
                    <span className={blueprint.activity === 'reaction' ? 'activity reaction' : 'activity'}>
                      {blueprint.activity === 'reaction' ? <FlaskConical /> : <Factory />}
                      {blueprint.activity === 'reaction' ? 'Реакция' : 'Производство'}
                    </span>
                    <strong>× {numberFormat.format(blueprint.materialQuantity)}</strong>
                    <small>{selectedMineral?.name}</small>
                  </div>
                </article>
              );
            })}

            {!filteredBlueprints.length && (
              <div className="blueprint-empty">
                <Gem aria-hidden="true" />
                <p>Для выбранных условий чертежей нет</p>
              </div>
            )}

            {visibleCount < filteredBlueprints.length && (
              <Button
                variant="outline"
                size="lg"
                className="load-more"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Показать ещё {Math.min(PAGE_SIZE, filteredBlueprints.length - visibleCount)}
              </Button>
            )}
          </div>
        </section>
      </div>
      </TabsContent>

      <TabsContent value="sources" className="tab-canvas">
        <div className="source-grid">
          <section className="tree-panel all-minerals-panel" aria-labelledby="all-minerals-title">
            <div className="panel-head">
              <div>
                <span className="step-number">01</span>
                <h2 id="all-minerals-title">Минералы и продукты льда</h2>
              </div>
              <span className="result-count">{filteredMinerals.length}</span>
            </div>
            <label className="search-box source-search">
              <Search aria-hidden="true" />
              <Input
                value={mineralQuery}
                onChange={(event) => setMineralQuery(event.target.value)}
                placeholder="Название минерала или продукта льда"
                aria-label="Поиск минерала или продукта льда"
              />
            </label>
            <div className="all-minerals-list" role="listbox" aria-label="Минералы и продукты льда">
              {filteredMinerals.map((mineral, index) => {
                const oreCount = data.ores.filter((ore) =>
                  ore.minerals.some((item) => item.id === mineral.id),
                ).length;
                const originRank = mineralOriginRank(data.ores, mineral.id);
                const previousRank = index > 0
                  ? mineralOriginRank(data.ores, filteredMinerals[index - 1].id)
                  : null;
                return (
                  <Fragment key={mineral.id}>
                  {originRank !== previousRank && (
                    <div className="mineral-origin-label">
                      <span>{mineralOriginLabel(originRank)}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={mineral.id === sourceMineralId}
                    className="source-mineral-row"
                    onClick={() => setSourceMineralId(mineral.id)}
                  >
                    <img src={iconUrl(mineral.id)} alt="" />
                    <span>
                      <strong>{mineral.name}</strong>
                      <small>ID {mineral.id}</small>
                    </span>
                    <span className="ore-source-count">
                      <b>{oreCount}</b>
                      <small>источников</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                  </Fragment>
                );
              })}
              {!filteredMinerals.length && <p className="empty-note">Ничего не найдено</p>}
            </div>
          </section>

          <section className="tree-panel source-ores-panel" aria-labelledby="source-ores-title">
            <div className="panel-head">
              <div>
                <span className="step-number">02</span>
                <h2 id="source-ores-title">Руда и лёд</h2>
              </div>
              <span className="result-count">{sourceOres.length}</span>
            </div>

            {sourceMineral && (
              <div className="source-mineral-hero">
                <img src={iconUrl(sourceMineral.id)} alt="" />
                <div>
                  <span className="eyebrow">Выбранный материал</span>
                  <h3>{sourceMineral.name}</h3>
                  <p>Получается из {sourceOres.length} источников сырья</p>
                </div>
                <Badge variant="outline">ID {sourceMineral.id}</Badge>
              </div>
            )}

            <div className="source-ore-list">
              {sourceOres.map(({ ore, mineral }) => (
                <button
                  type="button"
                  className="source-ore-row"
                  key={ore.id}
                  onClick={() => openSourceOre(ore, mineral)}
                  aria-label={`Открыть ${ore.name} во вкладке Руда — чертежи`}
                >
                  <img src={iconUrl(ore.id)} alt="" />
                  <div className="source-ore-copy">
                    <h3>{ore.name}</h3>
                    <p>{ore.kind} · {ore.grade}</p>
                    <small>{numberFormat.format(ore.portion)} ед. в партии · {ore.volume} м³/ед.</small>
                  </div>
                  <div className="source-yield">
                    <span>Выход</span>
                    <strong>{yieldLabel(mineral)}</strong>
                    <small>{mineral.random ? 'случайно' : 'ед./партию'}</small>
                  </div>
                  <ChevronRight className="source-open-icon" aria-hidden="true" />
                </button>
              ))}
              {!sourceOres.length && (
                <div className="blueprint-empty">
                  <Gem aria-hidden="true" />
                  <p>В справочнике нет руды или льда с этим материалом</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </TabsContent>

      <TabsContent value="blueprints" className="tab-canvas">
        <div className="blueprint-workspace-grid">
          <section className="tree-panel blueprint-catalog-panel" aria-labelledby="blueprint-catalog-title">
            <div className="panel-head">
              <div>
                <span className="step-number">01</span>
                <h2 id="blueprint-catalog-title">Все чертежи</h2>
              </div>
              <span className="result-count">{numberFormat.format(filteredCatalogBlueprints.length)}</span>
            </div>
            <div className="blueprint-catalog-controls">
              <label className="search-box">
                <Search aria-hidden="true" />
                <Input
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Название предмета или чертежа"
                  aria-label="Поиск по всем чертежам"
                />
              </label>
              <NativeSelect
                value={catalogKind}
                onChange={(event) => {
                  setCatalogKind(event.target.value as BlueprintKind);
                  setCatalogGroup('all');
                }}
                aria-label="Категория чертежей"
              >
                <NativeSelectOption value="all">Все типы</NativeSelectOption>
                {Object.entries(blueprintKindLabels).map(([value, label]) => (
                  <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                value={catalogActivity}
                onChange={(event) => setCatalogActivity(event.target.value as typeof catalogActivity)}
                aria-label="Тип производства в списке чертежей"
              >
                <NativeSelectOption value="all">Все операции</NativeSelectOption>
                <NativeSelectOption value="manufacturing">Производство</NativeSelectOption>
                <NativeSelectOption value="reaction">Реакции</NativeSelectOption>
              </NativeSelect>
              {catalogKind !== 'all' && (
                <NativeSelect
                  className="catalog-group-select"
                  value={catalogGroup}
                  onChange={(event) => setCatalogGroup(event.target.value)}
                  aria-label="Подтип готового продукта"
                >
                  <NativeSelectOption value="all">
                    {catalogKind === 'ships'
                      ? 'Все классы кораблей'
                      : catalogKind === 'weapons'
                        ? 'Все типы оружия'
                        : 'Все подтипы'}
                  </NativeSelectOption>
                  {catalogGroupOptions.map((option) => (
                    <NativeSelectOption value={option.value} key={option.value}>
                      {option.label} · {numberFormat.format(option.count)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>

            <div className="blueprint-catalog-list" role="listbox" aria-label="Все чертежи">
              {filteredCatalogBlueprints.slice(0, catalogVisibleCount).map((blueprint) => {
                const product = blueprint.products[0];
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={blueprint.id === dependencyBlueprintId}
                    className="blueprint-catalog-row"
                    data-blueprint-id={blueprint.id}
                    key={`${blueprint.activity}-${blueprint.id}`}
                    onClick={() => selectCatalogBlueprint(blueprint.id)}
                  >
                    <img src={productIconUrl(product?.id ?? blueprint.id)} alt="" loading="lazy" />
                    <span className="blueprint-catalog-copy">
                      <strong>{product?.name ?? blueprint.name}</strong>
                      <small>{blueprint.name}</small>
                      <span>
                        {product?.groupRu || product?.group || blueprintKindLabels[blueprintKind(product)]} ·{' '}
                        {activityLabel(blueprint.activity)} ·{' '}
                        {blueprint.recipeStatus === 'unavailable'
                          ? 'состав недоступен'
                          : blueprint.recipeStatus === 'legacy'
                            ? `архивный состав · ${blueprint.materials.length} материалов`
                            : `${blueprint.materials.length} материалов`}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}

              {!filteredCatalogBlueprints.length && <p className="empty-note">Ничего не найдено</p>}
              {catalogVisibleCount < filteredCatalogBlueprints.length && (
                <Button
                  variant="outline"
                  className="load-more"
                  onClick={() => setCatalogVisibleCount((count) => count + BLUEPRINT_PAGE_SIZE)}
                >
                  Показать ещё {Math.min(BLUEPRINT_PAGE_SIZE, filteredCatalogBlueprints.length - catalogVisibleCount)}
                </Button>
              )}
            </div>
          </section>

          <section className="tree-panel dependency-canvas-panel" aria-labelledby="dependency-title">
            <div className="panel-head dependency-panel-head">
              <div>
                <span className="step-number">02</span>
                <h2 id="dependency-title">Дерево зависимостей</h2>
              </div>
              <div className="dependency-panel-actions">
                {previousDependencyBlueprint && (
                  <button
                    type="button"
                    className="blueprint-back-button"
                    onClick={returnToPreviousBlueprint}
                    aria-label={`Вернуться к чертежу ${previousDependencyBlueprint.name}`}
                  >
                    <ChevronLeft aria-hidden="true" />
                    <span>Назад</span>
                    <strong>{previousDependencyBlueprint.products[0]?.name ?? previousDependencyBlueprint.name}</strong>
                  </button>
                )}
                {selectedDependencyBlueprint && (
                  <span className="dependency-calculation-note">
                    {blueprintTreeMode === 'skills'
                      ? selectedDependencyBlueprint.skills.length
                        ? `${selectedDependencyBlueprint.skills.length} прямых · ${blueprintSkillEstimate?.totalCount ?? 0} навыков в цепочке`
                        : 'Навыки для этого процесса не требуются'
                      : selectedDependencyBlueprint.recipeStatus === 'unavailable'
                        ? 'Действующий состав отсутствует'
                        : selectedDependencyBlueprint.recipeStatus === 'legacy'
                          ? `1 запуск · ${formatDuration(selectedDependencyBlueprint.time)} · материалы EveInfo, время SDE`
                          : '1 запуск · базовые количества SDE'}
                  </span>
                )}
              </div>
            </div>

            <div className="blueprint-tree-mode-tabs" role="tablist" aria-label="Содержимое дерева чертежа">
              <button
                type="button"
                role="tab"
                aria-selected={blueprintTreeMode === 'materials'}
                className={blueprintTreeMode === 'materials' ? 'is-active' : ''}
                onClick={() => setBlueprintTreeMode('materials')}
              >
                <Boxes aria-hidden="true" />
                <span>Материалы</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={blueprintTreeMode === 'skills'}
                className={blueprintTreeMode === 'skills' ? 'is-active' : ''}
                onClick={() => setBlueprintTreeMode('skills')}
              >
                <BookOpen aria-hidden="true" />
                <span>Навыки</span>
                {selectedDependencyBlueprint && (
                  <small>{numberFormat.format(selectedDependencyBlueprint.skills.length)}</small>
                )}
              </button>
            </div>

            {selectedDependencyBlueprint && (
              <details className="selected-blueprint-description" open>
                <summary>О чертеже и результате</summary>
                <div className="blueprint-overview-grid">
                  <div>
                    <span>Что производится</span>
                    <strong>{selectedDependencyProduct?.name ?? 'Продукт не указан'}</strong>
                    <small>ID {selectedDependencyProduct?.id ?? '—'}</small>
                  </div>
                  <div>
                    <span>Тип предмета</span>
                    <strong>{selectedDependencyProduct?.categoryRu ?? selectedDependencyProduct?.category ?? 'Не указан'}</strong>
                    <small>{selectedDependencyProduct?.groupRu ?? selectedDependencyProduct?.group ?? 'Группа не указана'}</small>
                  </div>
                  <div>
                    <span>Результат запуска</span>
                    <strong>× {numberFormat.format(selectedDependencyProduct?.quantity ?? 1)}</strong>
                    <small>
                      {selectedDependencyBlueprint.recipeStatus === 'unavailable'
                        ? 'состав недоступен'
                        : selectedDependencyBlueprint.recipeStatus === 'legacy'
                          ? `${selectedDependencyBlueprint.materials.length} видов · архив`
                          : `${selectedDependencyBlueprint.materials.length} видов материалов`}
                    </small>
                  </div>
                  <div>
                    <span>Производственный процесс</span>
                    <strong>
                      {selectedDependencyBlueprint.recipeStatus === 'unavailable'
                        ? 'Недоступен'
                        : selectedDependencyBlueprint.recipeStatus === 'legacy'
                          ? 'Архивное производство'
                        : selectedDependencyIsPlanetary
                          ? 'Планетарная схема'
                          : activityLabel(selectedDependencyBlueprint.activity)}
                    </strong>
                    <small>
                      {selectedDependencyBlueprint.recipeStatus === 'unavailable'
                        ? 'устаревшая запись SDE'
                        : selectedDependencyBlueprint.recipeStatus === 'legacy'
                          ? `${formatDuration(selectedDependencyBlueprint.time)} за запуск · EVE SDE`
                        : `${formatDuration(selectedDependencyBlueprint.time)} за запуск`}
                    </small>
                  </div>
                </div>
                <p className="blueprint-overview-intro">
                  {blueprintTreeMode === 'skills' ? (
                    selectedDependencyBlueprint.skills.length ? (
                      <>
                        Для запуска процесса <strong>{activityLabel(selectedDependencyBlueprint.activity).toLocaleLowerCase('ru')}</strong>{' '}
                        нужны перечисленные ниже навыки. Дерево также показывает все их предварительные требования и нужные уровни.
                      </>
                    ) : (
                      <>В EVE SDE для этого производственного процесса обязательные навыки не указаны.</>
                    )
                  ) : selectedDependencyBlueprint.recipeStatus === 'unavailable' ? (
                    <>Для <strong>{selectedDependencyProduct?.name ?? 'этого предмета'}</strong> в текущем EVE SDE нет корректного производственного состава.</>
                  ) : (
                    <>
                      {selectedDependencyIsPlanetary ? 'Эта схема перерабатывает планетарные материалы' : 'Этот чертёж используется для производства'}{' '}
                      <strong>{selectedDependencyProduct?.name ?? 'указанного предмета'}</strong>. Полный состав и промежуточные компоненты показаны в дереве ниже.
                    </>
                  )}
                </p>
                {blueprintTreeMode === 'materials' && productionTimeEstimate && selectedDependencyBlueprint.recipeStatus !== 'unavailable' && (
                  <section className="blueprint-time-estimate" aria-label="Оценка времени производства">
                    <div className="blueprint-time-heading">
                      <span>Оценка времени для одного запуска</span>
                      <small>
                        {numberFormat.format(Math.max(0, productionTimeEstimate.blueprintJobs - 1))} запусков ·{' '}
                        {numberFormat.format(productionTimeEstimate.componentBlueprints)} видов компонентов
                      </small>
                    </div>
                    <div className="blueprint-time-grid">
                      <div>
                        <span>Компоненты · 1 общая линия</span>
                        <strong>{formatEstimatedDuration(componentSequentialSeconds)}</strong>
                        <small>все операции последовательно</small>
                      </div>
                      <div>
                        <span>Полный цикл · 1 общая линия</span>
                        <strong>{formatEstimatedDuration(productionTimeEstimate.sequentialSeconds)}</strong>
                        <small>компоненты и готовый продукт</small>
                      </div>
                      <div>
                        <span>Компоненты · по 1 линии на тип</span>
                        <strong>{formatEstimatedDuration(componentParallelSeconds)}</strong>
                        <small>разные рецепты выполняются одновременно</small>
                      </div>
                      <div>
                        <span>Полный цикл · по 1 линии на тип</span>
                        <strong>{formatEstimatedDuration(productionTimeEstimate.parallelSeconds)}</strong>
                        <small>затем запуск итогового чертежа</small>
                      </div>
                    </div>
                    <p>
                      Это время производства промежуточных предметов, а не сбора ресурсов. В режиме «по 1 линии на тип» разные рецепты выполняются одновременно, но все запуски одного рецепта идут последовательно. Повторяющиеся компоненты объединены в общий спрос; остатки от полных партий используются всей цепочкой. Базовое время EVE SDE без навыков, имплантов и бонусов сооружений. Добыча, переработка и доставка сырья не учитываются.
                      {productionTimeEstimate.limitedBranches > 0 && (
                        <> {productionTimeEstimate.limitedBranches} недоступных, циклических или слишком глубоких ветвей не включено.</>
                      )}
                    </p>
                  </section>
                )}
                {blueprintTreeMode === 'skills' && blueprintSkillEstimate && blueprintSkillEstimate.directCount > 0 && (
                  <section className="skill-training-estimate blueprint-skills-summary" aria-label="Оценка навыков для чертежа">
                    <div className="skill-training-heading">
                      <div>
                        <span>Подготовка к использованию чертежа</span>
                        <small>С нуля · Omega-клон · характеристики 20 / 20</small>
                      </div>
                    </div>
                    <div className="skill-training-grid">
                      <div>
                        <span>Прямые требования</span>
                        <strong>{numberFormat.format(blueprintSkillEstimate.directCount)}</strong>
                        <small>навыков производственного процесса</small>
                      </div>
                      <div>
                        <span>Вся цепочка</span>
                        <strong>{numberFormat.format(blueprintSkillEstimate.totalCount)} навыков</strong>
                        <small>{numberFormat.format(blueprintSkillEstimate.totalSkillPoints)} SP</small>
                      </div>
                      <div>
                        <span>Время изучения с нуля</span>
                        <strong>{formatSkillTrainingDuration(blueprintSkillEstimate.totalSeconds)}</strong>
                        <small>повторяющиеся требования учтены один раз</small>
                      </div>
                    </div>
                  </section>
                )}
                {selectedDependencyBlueprint.recipeStatus !== 'available' && (
                  <div className={`blueprint-recipe-warning${selectedDependencyBlueprint.recipeStatus === 'legacy' ? ' is-legacy' : ''}`} role="note">
                    <strong>
                      {selectedDependencyBlueprint.recipeStatus === 'legacy'
                        ? 'Архивный состав производства'
                        : 'Состав производства отсутствует'}
                    </strong>
                    <p>{selectedDependencyBlueprint.recipeNote}</p>
                    {selectedDependencyBlueprint.recipeSource && (
                      <a href={selectedDependencyBlueprint.recipeSource} target="_blank" rel="noreferrer">
                        Источник: EveInfo
                      </a>
                    )}
                  </div>
                )}
                {selectedDependencyBlueprint.description && (
                  <div className="blueprint-sde-description">
                    <span>Описание предмета из EVE SDE</span>
                    <p>{selectedDependencyBlueprint.description}</p>
                  </div>
                )}
                <details className="product-characteristics">
                  <summary>
                    <span>Характеристики готового продукта</span>
                    {!characteristicsLoading && !characteristicsError && (
                      <small>{selectedProductCharacteristicCount}</small>
                    )}
                  </summary>
                  {characteristicsLoading ? (
                    <div className="characteristics-status">
                      <LoaderCircle className="spin" aria-hidden="true" />
                      <span>Загружаю характеристики…</span>
                    </div>
                  ) : characteristicsError ? (
                    <p className="characteristics-empty">Не удалось загрузить характеристики предмета.</p>
                  ) : selectedProductCharacteristics?.groups.length ? (
                    <div className="characteristic-groups">
                      {selectedProductCharacteristics.groups.map((group) => (
                        <section className="characteristic-group" key={group.id}>
                          <h4>{group.name}</h4>
                          <div className="characteristic-grid">
                            {group.attributes.map((attribute) => (
                              <div className="characteristic-row" key={attribute.id}>
                                <span title={attribute.name}>{attribute.name}</span>
                                <strong>{formatCharacteristicValue(attribute)}</strong>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="characteristics-empty">Для этого предмета характеристики в EVE SDE не указаны.</p>
                  )}
                </details>
              </details>
            )}

            {selectedDependencyBlueprint && blueprintTreeMode === 'skills' && !selectedDependencyBlueprint.skills.length ? (
              <div className="dependency-empty">
                <div className="dependency-empty-icon"><BookOpen aria-hidden="true" /></div>
                <h3>Обязательные навыки не указаны</h3>
                <p>Для этого производственного процесса в текущем EVE SDE нет требований к навыкам.</p>
              </div>
            ) : selectedDependencyBlueprint ? (
              <div className="dependency-canvas-scroll">
                <div className="dependency-tree">
                  {blueprintTreeMode === 'materials' ? (
                    <BlueprintDependencyBranch
                      blueprint={selectedDependencyBlueprint}
                      requiredQuantity={selectedDependencyBlueprint.products[0]?.quantity ?? 1}
                      runs={1}
                      depth={0}
                      path={new Set<number>()}
                      mineralById={mineralById}
                      producersByProductId={producersByProductId}
                      oreSourcesByMineralId={oreSourcesByMineralId}
                      planetaryCommodityById={planetaryCommodityById}
                      planetById={planetById}
                      onSelectBlueprint={selectNestedBlueprint}
                      root
                      rootAside={<BlueprintModelPreview product={selectedDependencyProduct} />}
                    />
                  ) : (
                    <BlueprintSkillTree
                      blueprint={selectedDependencyBlueprint}
                      skillById={skillById}
                      onSelectSkill={openBlueprintSkill}
                      totalSkillCount={blueprintSkillEstimate?.totalCount ?? selectedDependencyBlueprint.skills.length}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="dependency-empty">
                <div className="dependency-empty-icon"><FileText aria-hidden="true" /></div>
                <h3>Выберите чертёж</h3>
                <p>Здесь появится цепочка материалов: чертежи компонентов, минералы, продукты льда, руда и лёд.</p>
              </div>
            )}
          </section>
        </div>
      </TabsContent>

      <TabsContent value="planetary" className="tab-canvas">
        <div className="planetary-grid">
          <section className="tree-panel pi-catalog-panel" aria-labelledby="pi-catalog-title">
            <div className="panel-head">
              <div>
                <span className="step-number">01</span>
                <h2 id="pi-catalog-title">Материалы PI</h2>
              </div>
              <span className="result-count">{filteredPlanetaryCommodities.length}</span>
            </div>

            <div className="pi-catalog-controls">
              <label className="search-box">
                <Search aria-hidden="true" />
                <Input
                  value={planetaryQuery}
                  onChange={(event) => setPlanetaryQuery(event.target.value)}
                  placeholder="Название ресурса или товара"
                  aria-label="Поиск планетарных материалов"
                />
              </label>
              <NativeSelect
                value={planetaryTier}
                onChange={(event) => setPlanetaryTier(event.target.value as 'all' | PlanetaryTier)}
                aria-label="Уровень планетарного материала"
              >
                <NativeSelectOption value="all">Все уровни P0–P4</NativeSelectOption>
                {(Object.keys(planetaryTierLabels) as PlanetaryTier[]).map((tier) => (
                  <NativeSelectOption value={tier} key={tier}>{tier} · {planetaryTierLabels[tier]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="pi-catalog-list" role="listbox" aria-label="Планетарные материалы">
              {filteredPlanetaryCommodities.map((commodity, index) => (
                <Fragment key={commodity.id}>
                  {(index === 0 || filteredPlanetaryCommodities[index - 1].tier !== commodity.tier) && (
                    <div className={`pi-tier-heading pi-tier-${commodity.tier.toLocaleLowerCase('en')}`}>
                      <b>{commodity.tier}</b>
                      <span>{planetaryTierLabels[commodity.tier]}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={commodity.id === selectedPlanetaryId}
                    className="pi-catalog-row"
                    onClick={() => setSelectedPlanetaryId(commodity.id)}
                  >
                    <img src={productIconUrl(commodity.id)} alt="" loading="lazy" />
                    <span className="pi-catalog-copy">
                      <strong>{commodity.name}</strong>
                      <small>
                        {commodity.recipe
                          ? `Выход ${numberFormat.format(commodity.recipe.outputQuantity)} · ${formatDuration(commodity.recipe.cycleTime)}`
                          : `${commodity.planets.length} типов планет`}
                      </small>
                    </span>
                    <span className={`pi-tier-badge pi-tier-${commodity.tier.toLocaleLowerCase('en')}`}>
                      {commodity.tier}
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </Fragment>
              ))}
              {!filteredPlanetaryCommodities.length && <p className="empty-note">Ничего не найдено</p>}
            </div>
          </section>

          <section className="tree-panel pi-tree-panel" aria-labelledby="pi-tree-title">
            <div className="panel-head pi-panel-head">
              <div>
                <span className="step-number">02</span>
                <h2 id="pi-tree-title">
                  {selectedPlanetaryCommodity?.tier === 'P0' ? 'Планеты-источники' : 'Производственная цепочка'}
                </h2>
              </div>
              <a href={data.planetary.sourceUrl} target="_blank" rel="noreferrer">Источник: EVE Space</a>
            </div>

            {selectedPlanetaryCommodity?.tier === 'P0' ? (
              <div className="pi-source-view">
                <article className="pi-selected-resource">
                  <img src={productIconUrl(selectedPlanetaryCommodity.id)} alt="" />
                  <div>
                    <span className="pi-tier-label">P0 · добываемое сырьё</span>
                    <h3>{selectedPlanetaryCommodity.name}</h3>
                    <p>Доступно на {selectedPlanetaryCommodity.planets.length} типах планет</p>
                  </div>
                  <Badge variant="outline">ID {selectedPlanetaryCommodity.id}</Badge>
                </article>

                <div className="pi-source-planets-grid">
                  {selectedPlanetaryCommodity.planets.map((planetId) => {
                    const planet = planetById.get(planetId);
                    if (!planet) return null;
                    return (
                      <article className={`pi-source-planet-card pi-planet-${planet.id}`} key={planet.id}>
                        <img src={productIconUrl(planet.typeId)} alt="" loading="lazy" />
                        <div className="pi-source-planet-copy">
                          <span className="eyebrow">Планета</span>
                          <h3>{planet.name}</h3>
                          <p>{planet.nameEn}</p>
                        </div>
                        <div className="pi-source-resource-list">
                          <span>Ресурсы P0 на планете</span>
                          <div>
                            {planet.resources.map((resourceId) => {
                              const resource = planetaryCommodityById.get(resourceId);
                              return resource ? (
                                <span
                                  className={resource.id === selectedPlanetaryCommodity.id ? 'is-selected' : ''}
                                  key={resource.id}
                                >
                                  {resource.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : selectedPlanetaryCommodity ? (
              <div className="pi-tree-scroll">
                <div className="pi-tree">
                  <PlanetaryDependencyBranch
                    commodity={selectedPlanetaryCommodity}
                    requiredQuantity={selectedPlanetaryCommodity.recipe?.outputQuantity ?? 1}
                    runs={1}
                    commodityById={planetaryCommodityById}
                    planetById={planetById}
                    root
                  />
                </div>
              </div>
            ) : (
              <div className="dependency-empty">
                <div className="dependency-empty-icon"><Orbit aria-hidden="true" /></div>
                <h3>Выберите материал</h3>
                <p>Здесь появится цепочка P4 → P3 → P2 → P1 → P0 и подходящие типы планет.</p>
              </div>
            )}
          </section>
        </div>
      </TabsContent>

      <TabsContent value="skills" className="tab-canvas">
        <div className="blueprint-workspace-grid skill-workspace-grid">
          <section className="tree-panel blueprint-catalog-panel skill-catalog-panel" aria-labelledby="skill-catalog-title">
            <div className="panel-head">
              <div>
                <span className="step-number">01</span>
                <h2 id="skill-catalog-title">Все навыки</h2>
              </div>
              <span className="result-count">{numberFormat.format(filteredSkills.length)}</span>
            </div>

            <div className="blueprint-catalog-controls skill-catalog-controls">
              <label className="search-box">
                <Search aria-hidden="true" />
                <Input
                  value={skillQuery}
                  onChange={(event) => setSkillQuery(event.target.value)}
                  placeholder="Название или описание навыка"
                  aria-label="Поиск навыков"
                />
              </label>
              <NativeSelect
                className="skill-group-select"
                value={skillGroup}
                onChange={(event) => setSkillGroup(event.target.value)}
                aria-label="Группа навыков"
              >
                <NativeSelectOption value="all">Все группы навыков</NativeSelectOption>
                {skillGroupOptions.map((option) => (
                  <NativeSelectOption value={option.value} key={option.value}>
                    {option.label} · {numberFormat.format(option.count)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="blueprint-catalog-list skill-catalog-list" role="listbox" aria-label="Все навыки">
              {filteredSkills.slice(0, skillVisibleCount).map((skill) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={skill.id === selectedSkillId}
                  className="blueprint-catalog-row skill-catalog-row"
                  data-skill-id={skill.id}
                  key={skill.id}
                  onClick={() => selectCatalogSkill(skill.id)}
                >
                  <img src={productIconUrl(skill.id)} alt="" loading="lazy" />
                  <span className="blueprint-catalog-copy">
                    <strong>{skill.name}</strong>
                    <small>{skill.groupRu} · ID {skill.id}</small>
                    <span>
                      {skill.requirements.length
                        ? `${skill.requirements.length} прямых требований`
                        : 'Базовый навык'}{' '}
                      · множитель × {numberFormat.format(skill.rank)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
              {!filteredSkills.length && <p className="empty-note">Ничего не найдено</p>}
              {skillVisibleCount < filteredSkills.length && (
                <Button
                  variant="outline"
                  className="load-more"
                  onClick={() => setSkillVisibleCount((count) => count + SKILL_PAGE_SIZE)}
                >
                  Показать ещё {Math.min(SKILL_PAGE_SIZE, filteredSkills.length - skillVisibleCount)}
                </Button>
              )}
            </div>
          </section>

          <section className="tree-panel dependency-canvas-panel skill-tree-panel" aria-labelledby="skill-tree-title">
            <div className="panel-head dependency-panel-head">
              <div>
                <span className="step-number">02</span>
                <h2 id="skill-tree-title">Дерево требований</h2>
              </div>
              <div className="dependency-panel-actions">
                {previousSkill && (
                  <button
                    type="button"
                    className="blueprint-back-button"
                    onClick={returnToPreviousSkill}
                    aria-label={`Вернуться к навыку ${previousSkill.name}`}
                  >
                    <ChevronLeft aria-hidden="true" />
                    <span>Назад</span>
                    <strong>{previousSkill.name}</strong>
                  </button>
                )}
                {selectedSkill && (
                  <span className="dependency-calculation-note">
                    {selectedSkill.requirements.length
                      ? `${selectedSkill.requirements.length} прямых требований`
                      : 'Предварительные навыки не требуются'}
                  </span>
                )}
              </div>
            </div>

            {selectedSkill && (
              <details className="selected-blueprint-description skill-overview" open>
                <summary>О навыке</summary>
                <div className="blueprint-overview-grid">
                  <div>
                    <span>Группа</span>
                    <strong>{selectedSkill.groupRu}</strong>
                    <small>{selectedSkill.group}</small>
                  </div>
                  <div>
                    <span>Множитель обучения</span>
                    <strong>× {numberFormat.format(selectedSkill.rank)}</strong>
                    <small>ранг навыка</small>
                  </div>
                  <div>
                    <span>Основная характеристика</span>
                    <strong>{selectedSkill.primaryAttribute}</strong>
                    <small>влияет на скорость обучения</small>
                  </div>
                  <div>
                    <span>Дополнительная характеристика</span>
                    <strong>{selectedSkill.secondaryAttribute}</strong>
                    <small>учитывается с половинным весом</small>
                  </div>
                </div>
                {skillTrainingEstimate && (
                  <section className="skill-training-estimate" aria-label="Оценка времени изучения">
                    <div className="skill-training-heading">
                      <div>
                        <span>Время изучения с нуля</span>
                        <small>Omega-клон · характеристики 20 / 20</small>
                      </div>
                      <label>
                        <span>Целевой уровень</span>
                        <NativeSelect
                          value={skillTargetLevel}
                          onChange={(event) => setSkillTargetLevel(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
                          aria-label="Целевой уровень выбранного навыка"
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <NativeSelectOption value={level} key={level}>
                              Уровень {formatSkillLevel(level)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                    </div>
                    <div className="skill-training-grid">
                      <div>
                        <span>Чтобы открыть навык</span>
                        <strong>{formatSkillTrainingDuration(skillTrainingEstimate.prerequisiteSeconds)}</strong>
                        <small>
                          {skillTrainingEstimate.prerequisiteCount} навыков ·{' '}
                          {numberFormat.format(skillTrainingEstimate.prerequisiteSkillPoints)} SP
                        </small>
                      </div>
                      <div>
                        <span>{selectedSkill.name} до {formatSkillLevel(skillTargetLevel)}</span>
                        <strong>{formatSkillTrainingDuration(skillTrainingEstimate.selectedSeconds)}</strong>
                        <small>{numberFormat.format(skillTrainingEstimate.selectedSkillPoints)} SP</small>
                      </div>
                      <div>
                        <span>Вся цепочка и выбранный навык</span>
                        <strong>{formatSkillTrainingDuration(skillTrainingEstimate.totalSeconds)}</strong>
                        <small>{numberFormat.format(skillTrainingEstimate.totalSkillPoints)} SP с нуля</small>
                      </div>
                    </div>
                    <p>
                      Повторяющиеся требования учитываются один раз на максимальном нужном уровне. Фактическое время зависит от навыков персонажа, имплантов, ускорителей и ремапа.{' '}
                      <a href="https://developers.eveonline.com/docs/guides/useful-formulae/" target="_blank" rel="noreferrer">
                        Формула EVE Developers
                      </a>
                    </p>
                  </section>
                )}
                {selectedSkill.description && (
                  <div className="blueprint-sde-description">
                    <span>Описание навыка из EVE SDE</span>
                    <p>{selectedSkill.description}</p>
                  </div>
                )}
              </details>
            )}

            {selectedSkill ? (
              <div className="dependency-canvas-scroll skill-dependency-scroll">
                <div className="dependency-tree">
                  <SkillDependencyBranch
                    skill={selectedSkill}
                    depth={0}
                    path={new Set<number>()}
                    skillById={skillById}
                    onSelectSkill={selectNestedSkill}
                    root
                  />
                </div>
              </div>
            ) : (
              <div className="dependency-empty">
                <div className="dependency-empty-icon"><BookOpen aria-hidden="true" /></div>
                <h3>Выберите навык</h3>
                <p>Здесь появится полная цепочка предварительных навыков и требуемые уровни.</p>
              </div>
            )}
          </section>
        </div>
      </TabsContent>
      <TabsContent value="fitting" className="tab-canvas">
        <FittingWorkbench />
      </TabsContent>
      </Tabs>
    </main>
  );
}
