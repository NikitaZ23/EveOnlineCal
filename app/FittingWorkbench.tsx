'use client';

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BatteryCharging,
  Box,
  Check,
  ChevronRight,
  CircleGauge,
  Clipboard,
  Cpu,
  Crosshair,
  Download,
  FolderOpen,
  Gauge,
  Layers3,
  LoaderCircle,
  Minus,
  PackageOpen,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShipWheel,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type SlotName = 'high' | 'mid' | 'low' | 'rig' | 'subsystem' | 'service';
type FitSection = SlotName | 'drone' | 'fighter';

type FittingHull = {
  id: number;
  name: string;
  nameRu: string;
  groupId: number;
  group: string;
  groupRu: string;
  kind: 'ship' | 'structure';
  techLevel: number;
  bonusSkillIds: number[];
  bonusGroupIds: number[];
  bonusTerms: string[];
  description: string;
  slots: Record<SlotName, number>;
  resources: {
    cpu: number;
    powergrid: number;
    calibration: number;
    turrets: number;
    launchers: number;
    rigSize: number;
    droneBay: number;
    droneBandwidth: number;
    fighterBay: number;
    cargo: number;
  };
  defenses: { shield: number; armor: number; hull: number };
};

type FittingItem = {
  id: number;
  name: string;
  nameRu: string;
  groupId: number;
  group: string;
  groupRu: string;
  categoryId: number;
  category: string;
  categoryRu: string;
  metaGroupId: number;
  metaGroup: string;
  metaGroupRu: string;
  metaLevel: number;
  techLevel: number;
  slot: FitSection;
  description: string;
  cpu: number;
  powergrid: number;
  calibration: number;
  rigSize: number;
  chargeSize: number;
  volume: number;
  bandwidth: number;
  turret: boolean;
  launcher: boolean;
  maxGroupFitted: number;
  maxTypeFitted: number;
  allowedGroupIds: number[];
  allowedTypeIds: number[];
  chargeGroupIds: number[];
  subsystemSlot: number;
  skills: Array<{ id: number; name: string; level: number }>;
  effects: Array<{
    attributeId: number;
    name: string;
    label: string;
    value: number;
    unitId: number;
    unit: string;
    highIsGood: boolean | null;
  }>;
};

type FittingCharge = {
  id: number;
  name: string;
  nameRu: string;
  groupId: number;
  group: string;
  groupRu: string;
  chargeSize: number;
  volume: number;
};

type FittingData = {
  meta: {
    sdeBuild: number;
    releaseDate: string;
    hullCount: number;
    itemCount: number;
    chargeCount: number;
    calculation: string;
  };
  hulls: FittingHull[];
  items: FittingItem[];
  charges: FittingCharge[];
};

type FittedEntry = { itemId: number; chargeId?: number; quantity?: number };
type FittedRacks = Record<SlotName, Array<FittedEntry | null>> & {
  drone: FittedEntry[];
  fighter: FittedEntry[];
};

type SavedFit = {
  hullId: number;
  fitName: string;
  hullKind: 'ship' | 'structure';
  hullQuery: string;
  hullGroup: string;
  hullTech: string;
  itemQuery: string;
  itemGroup: string;
  itemLevel: string;
  itemPreference: 'recommended' | 'all';
  selectedSection: FitSection;
  fitted: FittedRacks;
};

type SavedFitPreset = SavedFit & {
  id: string;
  savedAt: string;
};

const FIT_STATE_KEY = 'eve-production-tree:fitting:v1';
const FIT_PRESETS_KEY = 'eve-production-tree:fitting:presets:v1';
const fixedSlots: SlotName[] = ['high', 'mid', 'low', 'rig', 'subsystem', 'service'];
const metaGroupOrder = [1, 54, 3, 2, 53, 14, 4, 52, 6, 5, 15, 19, 17, 0];
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function metaOrder(metaGroupId: number) {
  const index = metaGroupOrder.indexOf(metaGroupId);
  return index >= 0 ? index : metaGroupOrder.length + metaGroupId;
}

const slotLabels: Record<FitSection, string> = {
  high: 'Разъёмы большой мощности',
  mid: 'Разъёмы средней мощности',
  low: 'Разъёмы малой мощности',
  rig: 'Тюнинг-модули',
  subsystem: 'Подсистемы',
  service: 'Служебные модули',
  drone: 'Дроны',
  fighter: 'Истребители',
};

const slotShortLabels: Record<FitSection, string> = {
  high: 'HIGH',
  mid: 'MED',
  low: 'LOW',
  rig: 'RIG',
  subsystem: 'SUB',
  service: 'SERVICE',
  drone: 'DRONES',
  fighter: 'FIGHTERS',
};

function iconUrl(id: number) {
  return `https://images.evetech.net/types/${id}/icon?size=64`;
}

function emptyRacks(hull: FittingHull): FittedRacks {
  return {
    high: Array.from({ length: hull.slots.high }, () => null),
    mid: Array.from({ length: hull.slots.mid }, () => null),
    low: Array.from({ length: hull.slots.low }, () => null),
    rig: Array.from({ length: hull.slots.rig }, () => null),
    subsystem: Array.from({ length: hull.slots.subsystem }, () => null),
    service: Array.from({ length: hull.slots.service }, () => null),
    drone: [],
    fighter: [],
  };
}

function firstSection(hull: FittingHull): FitSection {
  return fixedSlots.find((slot) => hull.slots[slot] > 0)
    ?? (hull.resources.droneBay > 0 ? 'drone' : hull.resources.fighterBay > 0 ? 'fighter' : 'high');
}

function normalizeRacks(hull: FittingHull, saved: FittedRacks | undefined): FittedRacks {
  const racks = emptyRacks(hull);
  if (!saved) return racks;
  for (const slot of fixedSlots) {
    const entries = Array.isArray(saved[slot]) ? saved[slot] : [];
    racks[slot] = racks[slot].map((_, index) => entries[index] ?? null);
  }
  racks.drone = Array.isArray(saved.drone) ? saved.drone.filter(Boolean) : [];
  racks.fighter = Array.isArray(saved.fighter) ? saved.fighter.filter(Boolean) : [];
  return racks;
}

function sectionAvailable(hull: FittingHull, section: FitSection) {
  if (section === 'drone') return hull.resources.droneBay > 0;
  if (section === 'fighter') return hull.resources.fighterBay > 0;
  return hull.slots[section] > 0;
}

function itemFitsHull(item: FittingItem, hull: FittingHull) {
  if (hull.kind === 'structure' && ![66, 87].includes(item.categoryId)) return false;
  if (hull.kind === 'ship' && item.categoryId === 66) return false;
  if (item.turret && hull.resources.turrets <= 0) return false;
  if (item.launcher && hull.resources.launchers <= 0) return false;
  if (item.slot === 'fighter' && hull.kind === 'structure' && !item.group.startsWith('Structure ')) return false;
  if (item.slot === 'fighter' && hull.kind === 'ship' && item.group.startsWith('Structure ')) return false;
  if (item.slot === 'subsystem' && !item.name.startsWith(`${hull.name} `)) return false;
  if (item.allowedTypeIds.length && !item.allowedTypeIds.includes(hull.id)) return false;
  if (item.allowedGroupIds.length && !item.allowedGroupIds.includes(hull.groupId)) return false;
  if (item.slot === 'rig' && item.rigSize > 0 && hull.resources.rigSize > 0 && item.rigSize !== hull.resources.rigSize) {
    return false;
  }
  return true;
}

function recommendationText(value: string) {
  return value
    .toLocaleLowerCase('en')
    .replace(/torpedoes/g, 'torpedo')
    .replace(/missiles/g, 'missile')
    .replace(/turrets/g, 'turret')
    .replace(/launchers/g, 'launcher')
    .replace(/weapons/g, 'weapon')
    .replace(/lasers/g, 'laser')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function itemMatchesHullBonus(item: FittingItem, hull: FittingHull) {
  if (hull.bonusGroupIds.includes(item.groupId)) return true;
  if (item.skills.some((skill) => hull.bonusSkillIds.includes(skill.id))) return true;
  const itemText = recommendationText(`${item.name} ${item.group} ${item.skills.map((skill) => skill.name).join(' ')}`);
  return hull.bonusTerms.some((term) => {
    const tokens = recommendationText(term).split(' ').filter((token) => token.length > 2);
    return tokens.length > 0 && tokens.every((token) => itemText.includes(token));
  });
}

function itemPreferredForHull(item: FittingItem, hull: FittingHull) {
  const miningGroup = /^(Mining Barge|Exhumer|Mining Frigate|Expedition Frigate)$/i.test(hull.group);
  const industrialCommand = hull.group === 'Industrial Command Ship';
  const itemText = `${item.name} ${item.group}`;
  const resourceModule = /strip miner|ice harvester|gas cloud|gas harvester|mining laser|compressor|industrial core/i.test(itemText);
  if (item.slot === 'high' && resourceModule) {
    if (miningGroup) return /strip miner|ice harvester|gas cloud|gas harvester|mining laser/i.test(itemText);
    if (industrialCommand) return true;
    return false;
  }
  if (industrialCommand && item.slot === 'high') {
    return /industrial core|command burst|compressor|tractor beam|cloaking device|salvager/i.test(itemText);
  }
  if (miningGroup && item.slot === 'high') return false;
  if ((item.powergrid > 0 && hull.resources.powergrid > 0 && item.powergrid > hull.resources.powergrid * 2)
    || (item.cpu > 0 && hull.resources.cpu > 0 && item.cpu > hull.resources.cpu * 2)) {
    return false;
  }
  if (item.turret || item.launcher) {
    if (itemMatchesHullBonus(item, hull)) return true;
    if (item.turret && hull.resources.turrets > 0 && hull.resources.launchers === 0) return true;
    if (item.launcher && hull.resources.launchers > 0 && hull.resources.turrets === 0) return true;
    return false;
  }
  return true;
}

function resourcePercent(used: number, total: number) {
  if (total <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, (used / total) * 100);
}

function fitLine(item: FittingItem, charge: FittingCharge | undefined) {
  return charge ? `${item.name}, ${charge.name}` : item.name;
}

function displayName(item: { name: string; nameRu: string }) {
  return item.nameRu && item.nameRu !== item.name ? item.nameRu : item.name;
}

function formatDogmaEffect(effect: FittingItem['effects'][number]) {
  if (effect.unitId === 137) {
    return { value: effect.value ? 'Да' : 'Нет', tone: '' };
  }
  if (effect.unitId === 105) {
    const direction = effect.highIsGood === null ? effect.value : effect.value * (effect.highIsGood ? 1 : -1);
    return {
      value: `${direction > 0 ? '+' : direction < 0 ? '−' : ''}${numberFormat.format(Math.abs(effect.value))}%`,
      tone: direction > 0 ? 'is-positive' : direction < 0 ? 'is-negative' : '',
    };
  }
  if (effect.unitId === 111) {
    const delta = (effect.value - 1) * 100;
    const direction = delta * (effect.highIsGood === false ? -1 : 1);
    return {
      value: `${direction > 0 ? '+' : direction < 0 ? '−' : ''}${numberFormat.format(Math.abs(delta))}%`,
      tone: direction > 0 ? 'is-positive' : direction < 0 ? 'is-negative' : '',
    };
  }
  if (effect.unitId === 101) {
    return { value: `${numberFormat.format(effect.value / 1000)} с`, tone: '' };
  }
  if (effect.unitId === 104) {
    return { value: `×${numberFormat.format(effect.value)}`, tone: effect.value > 1 ? 'is-positive' : '' };
  }
  return {
    value: `${numberFormat.format(effect.value)}${effect.unit ? ` ${effect.unit}` : ''}`,
    tone: '',
  };
}

function SectionIcon({ section }: { section: FitSection }) {
  if (section === 'high') return <Zap aria-hidden="true" />;
  if (section === 'mid') return <Gauge aria-hidden="true" />;
  if (section === 'low') return <BatteryCharging aria-hidden="true" />;
  if (section === 'rig') return <Wrench aria-hidden="true" />;
  if (section === 'subsystem') return <Layers3 aria-hidden="true" />;
  if (section === 'service') return <Box aria-hidden="true" />;
  if (section === 'fighter') return <Crosshair aria-hidden="true" />;
  return <PackageOpen aria-hidden="true" />;
}

function ResourceMeter({
  icon,
  label,
  used,
  total,
  suffix = '',
}: {
  icon: ReactNode;
  label: string;
  used: number;
  total: number;
  suffix?: string;
}) {
  const exceeded = used > total;
  return (
    <div className={`fit-resource ${exceeded ? 'is-exceeded' : ''}`}>
      <div className="fit-resource-head">
        <span>{icon}{label}</span>
        <b>{numberFormat.format(used)} / {numberFormat.format(total)}{suffix}</b>
      </div>
      <div className="fit-resource-track" aria-label={`${label}: ${used} из ${total}`}>
        <span style={{ width: `${resourcePercent(used, total)}%` }} />
      </div>
    </div>
  );
}

export default function FittingWorkbench() {
  const [data, setData] = useState<FittingData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [hullKind, setHullKind] = useState<'ship' | 'structure'>('ship');
  const [hullQuery, setHullQuery] = useState('');
  const [hullGroup, setHullGroup] = useState('all');
  const [hullTech, setHullTech] = useState('all');
  const [itemQuery, setItemQuery] = useState('');
  const [itemGroup, setItemGroup] = useState('all');
  const [itemLevel, setItemLevel] = useState('all');
  const [itemPreference, setItemPreference] = useState<'recommended' | 'all'>('recommended');
  const [selectedHullId, setSelectedHullId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<FitSection>('high');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [fitName, setFitName] = useState('Новый фит');
  const [fitted, setFitted] = useState<FittedRacks | null>(null);
  const [exchangeMode, setExchangeMode] = useState<'import' | 'export' | null>(null);
  const [exchangeText, setExchangeText] = useState('');
  const [exchangeMessage, setExchangeMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedFits, setSavedFits] = useState<SavedFitPreset[]>([]);
  const [selectedSavedFitId, setSelectedSavedFitId] = useState<string | null>(null);
  const [savedFitsOpen, setSavedFitsOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [tooltipItem, setTooltipItem] = useState<FittingItem | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const selectionEffectReady = useRef(false);

  function positionItemTooltip(clientX: number, clientY: number) {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const gap = 16;
    const edge = 12;
    const width = tooltip.offsetWidth || 340;
    const height = tooltip.offsetHeight || 250;
    let left = clientX + gap;
    let top = clientY + gap;
    if (left + width > window.innerWidth - edge) left = clientX - width - gap;
    if (top + height > window.innerHeight - edge) top = clientY - height - gap;
    left = Math.max(edge, Math.min(left, window.innerWidth - width - edge));
    top = Math.max(edge, Math.min(top, window.innerHeight - height - edge));
    tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  function showItemTooltip(item: FittingItem, event: ReactMouseEvent<HTMLElement>) {
    setTooltipItem(item);
    const { clientX, clientY } = event;
    window.requestAnimationFrame(() => positionItemTooltip(clientX, clientY));
  }

  function moveItemTooltip(event: ReactMouseEvent<HTMLElement>) {
    positionItemTooltip(event.clientX, event.clientY);
  }

  function focusItemTooltip(item: FittingItem, event: ReactFocusEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipItem(item);
    window.requestAnimationFrame(() => positionItemTooltip(rect.right, rect.top + Math.min(32, rect.height / 2)));
  }

  useEffect(() => {
    fetch('/eve-fitting-data.json')
      .then((response) => {
        if (!response.ok) throw new Error('Fitting data request failed');
        return response.json() as Promise<FittingData>;
      })
      .then((payload) => {
        let saved: Partial<SavedFit> = {};
        try {
          saved = JSON.parse(window.localStorage.getItem(FIT_STATE_KEY) ?? '{}') as Partial<SavedFit>;
        } catch {
          saved = {};
        }
        try {
          const storedPresets = JSON.parse(window.localStorage.getItem(FIT_PRESETS_KEY) ?? '[]') as SavedFitPreset[];
          setSavedFits(Array.isArray(storedPresets) ? storedPresets.slice(0, 100) : []);
        } catch {
          setSavedFits([]);
        }
        const savedHull = payload.hulls.find((hull) => hull.id === saved.hullId);
        const initialHull = savedHull
          ?? payload.hulls.find((hull) => hull.id === 638)
          ?? payload.hulls.find((hull) => hull.kind === 'ship')
          ?? payload.hulls[0];
        if (!initialHull) throw new Error('No fitting hulls');
        const requestedSection = saved.selectedSection;
        setData(payload);
        setHullKind(initialHull.kind);
        setHullQuery(typeof saved.hullQuery === 'string' ? saved.hullQuery : '');
        setHullGroup(typeof saved.hullGroup === 'string' ? saved.hullGroup : 'all');
        setHullTech(typeof saved.hullTech === 'string' ? saved.hullTech : 'all');
        setItemQuery(typeof saved.itemQuery === 'string' ? saved.itemQuery : '');
        setItemGroup(typeof saved.itemGroup === 'string' ? saved.itemGroup : 'all');
        setItemLevel(typeof saved.itemLevel === 'string' ? saved.itemLevel : 'all');
        setItemPreference(saved.itemPreference === 'all' ? 'all' : 'recommended');
        setSelectedHullId(initialHull.id);
        setFitName(typeof saved.fitName === 'string' && saved.fitName.trim() ? saved.fitName : `${initialHull.name} — новый фит`);
        setSelectedSection(
          requestedSection && sectionAvailable(initialHull, requestedSection)
            ? requestedSection
            : firstSection(initialHull),
        );
        setFitted(normalizeRacks(initialHull, saved.fitted));
        setHydrated(true);
      })
      .catch(() => setLoadError(true));
  }, []);

  const selectedHull = useMemo(
    () => data?.hulls.find((hull) => hull.id === selectedHullId) ?? null,
    [data, selectedHullId],
  );
  const itemById = useMemo(() => new Map(data?.items.map((item) => [item.id, item]) ?? []), [data]);
  const chargeById = useMemo(() => new Map(data?.charges.map((charge) => [charge.id, charge]) ?? []), [data]);
  const itemByName = useMemo(
    () => new Map(data?.items.flatMap((item) => [[item.name.toLocaleLowerCase('en'), item], [item.nameRu.toLocaleLowerCase('ru'), item]]) ?? []),
    [data],
  );
  const chargeByName = useMemo(
    () => new Map(data?.charges.flatMap((charge) => [[charge.name.toLocaleLowerCase('en'), charge], [charge.nameRu.toLocaleLowerCase('ru'), charge]]) ?? []),
    [data],
  );

  useEffect(() => {
    if (!hydrated || !selectedHull || !fitted) return;
    const saved: SavedFit = {
      hullId: selectedHull.id,
      fitName,
      hullKind,
      hullQuery,
      hullGroup,
      hullTech,
      itemQuery,
      itemGroup,
      itemLevel,
      itemPreference,
      selectedSection,
      fitted,
    };
    try {
      window.localStorage.setItem(FIT_STATE_KEY, JSON.stringify(saved));
    } catch {
      // The builder remains usable when browser storage is unavailable.
    }
  }, [fitted, fitName, hullGroup, hullKind, hullQuery, hullTech, hydrated, itemGroup, itemLevel, itemPreference, itemQuery, selectedHull, selectedSection]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FIT_PRESETS_KEY, JSON.stringify(savedFits));
    } catch {
      // Saved fits remain available for the current session.
    }
  }, [hydrated, savedFits]);

  const hullsForKind = useMemo(
    () => (data?.hulls ?? []).filter((hull) => hull.kind === hullKind),
    [data, hullKind],
  );

  const hullGroups = useMemo(() => {
    const groups = new Map<number, { id: number; name: string; count: number }>();
    for (const hull of hullsForKind) {
      const current = groups.get(hull.groupId);
      if (current) current.count += 1;
      else groups.set(hull.groupId, { id: hull.groupId, name: hull.groupRu || hull.group, count: 1 });
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [hullsForKind]);

  const hullTechLevels = useMemo(() => {
    const counts = new Map<number, number>();
    for (const hull of hullsForKind) counts.set(hull.techLevel, (counts.get(hull.techLevel) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a - b);
  }, [hullsForKind]);

  const filteredHulls = useMemo(() => {
    const needle = hullQuery.trim().toLocaleLowerCase('ru');
    return hullsForKind.filter((hull) => (hullGroup === 'all' || String(hull.groupId) === hullGroup)
      && (hullTech === 'all' || String(hull.techLevel) === hullTech)
      && (!needle
      || hull.name.toLocaleLowerCase('en').includes(needle)
      || hull.nameRu.toLocaleLowerCase('ru').includes(needle)
      || hull.group.toLocaleLowerCase('en').includes(needle)
      || hull.groupRu.toLocaleLowerCase('ru').includes(needle)));
  }, [hullGroup, hullQuery, hullTech, hullsForKind]);

  const compatibleItems = useMemo(() => {
    if (!data || !selectedHull) return [];
    return data.items.filter((item) => item.slot === selectedSection && itemFitsHull(item, selectedHull));
  }, [data, selectedHull, selectedSection]);

  const preferredItems = useMemo(
    () => selectedHull ? compatibleItems.filter((item) => itemPreferredForHull(item, selectedHull)) : [],
    [compatibleItems, selectedHull],
  );

  const availableItems = itemPreference === 'recommended' ? preferredItems : compatibleItems;

  const itemsForLevelOptions = useMemo(() => {
    const needle = itemQuery.trim().toLocaleLowerCase('ru');
    return availableItems.filter((item) => (itemGroup === 'all' || String(item.groupId) === itemGroup)
      && (!needle
        || item.name.toLocaleLowerCase('en').includes(needle)
        || item.nameRu.toLocaleLowerCase('ru').includes(needle)
        || item.group.toLocaleLowerCase('en').includes(needle)
        || item.groupRu.toLocaleLowerCase('ru').includes(needle)));
  }, [availableItems, itemGroup, itemQuery]);

  const itemLevels = useMemo(() => {
    const levels = new Map<number, { id: number; name: string; count: number }>();
    for (const item of itemsForLevelOptions) {
      const current = levels.get(item.metaGroupId);
      if (current) current.count += 1;
      else levels.set(item.metaGroupId, { id: item.metaGroupId, name: item.metaGroupRu || item.metaGroup, count: 1 });
    }
    return [...levels.values()].sort((a, b) => metaOrder(a.id) - metaOrder(b.id) || a.name.localeCompare(b.name, 'ru'));
  }, [itemsForLevelOptions]);

  useEffect(() => {
    if (itemLevel !== 'all' && !itemLevels.some((level) => String(level.id) === itemLevel)) setItemLevel('all');
  }, [itemLevel, itemLevels]);

  const levelFilteredItems = useMemo(
    () => itemsForLevelOptions.filter((item) => itemLevel === 'all' || String(item.metaGroupId) === itemLevel),
    [itemLevel, itemsForLevelOptions],
  );

  const itemGroups = useMemo(() => {
    const groups = new Map<number, { id: number; name: string; count: number }>();
    for (const item of availableItems) {
      const current = groups.get(item.groupId);
      if (current) current.count += 1;
      else groups.set(item.groupId, { id: item.groupId, name: item.groupRu || item.group, count: 1 });
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [availableItems]);

  const filteredItems = useMemo(() => {
    return [...levelFilteredItems]
      .sort((a, b) => metaOrder(a.metaGroupId) - metaOrder(b.metaGroupId)
        || a.metaLevel - b.metaLevel
        || displayName(a).localeCompare(displayName(b), 'ru'));
  }, [levelFilteredItems]);

  const filteredItemLevelCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of filteredItems) counts.set(item.metaGroupId, (counts.get(item.metaGroupId) ?? 0) + 1);
    return counts;
  }, [filteredItems]);

  useEffect(() => {
    if (!selectionEffectReady.current) {
      selectionEffectReady.current = true;
      return;
    }
    setItemGroup('all');
    setSelectedSlotIndex(null);
  }, [itemPreference, selectedSection, selectedHullId]);

  const allFixedEntries = useMemo(() => {
    if (!fitted) return [];
    return fixedSlots.flatMap((slot) => fitted[slot].filter((entry): entry is FittedEntry => Boolean(entry)));
  }, [fitted]);

  const totals = useMemo(() => {
    const modules = allFixedEntries.map((entry) => itemById.get(entry.itemId)).filter(Boolean) as FittingItem[];
    const drones = fitted?.drone.map((entry) => ({ entry, item: itemById.get(entry.itemId) })).filter((row) => row.item) ?? [];
    const fighters = fitted?.fighter.map((entry) => ({ entry, item: itemById.get(entry.itemId) })).filter((row) => row.item) ?? [];
    return {
      cpu: modules.reduce((sum, item) => sum + item.cpu, 0),
      powergrid: modules.reduce((sum, item) => sum + item.powergrid, 0),
      calibration: modules.reduce((sum, item) => sum + item.calibration, 0),
      turrets: modules.filter((item) => item.turret).length,
      launchers: modules.filter((item) => item.launcher).length,
      droneBay: drones.reduce((sum, row) => sum + (row.item?.volume ?? 0) * (row.entry.quantity ?? 1), 0),
      droneBandwidth: drones.reduce((sum, row) => sum + (row.item?.bandwidth ?? 0) * (row.entry.quantity ?? 1), 0),
      fighterBay: fighters.reduce((sum, row) => sum + (row.item?.volume ?? 0) * (row.entry.quantity ?? 1), 0),
      skills: new Map(modules.flatMap((item) => item.skills).map((skill) => [skill.id, skill])).size,
    };
  }, [allFixedEntries, fitted, itemById]);

  const violations = useMemo(() => {
    if (!selectedHull) return [];
    const result: string[] = [];
    if (totals.cpu > selectedHull.resources.cpu) result.push('Превышена мощность ЦПУ');
    if (totals.powergrid > selectedHull.resources.powergrid) result.push('Превышена мощность энергосети');
    if (totals.calibration > selectedHull.resources.calibration) result.push('Превышена калибровка');
    if (totals.turrets > selectedHull.resources.turrets) result.push('Превышен лимит турелей');
    if (totals.launchers > selectedHull.resources.launchers) result.push('Превышен лимит пусковых установок');
    if (totals.droneBay > selectedHull.resources.droneBay) result.push('Переполнен отсек дронов');
    if (totals.droneBandwidth > selectedHull.resources.droneBandwidth) result.push('Превышен канал управления дронами');
    if (totals.fighterBay > selectedHull.resources.fighterBay) result.push('Переполнен отсек истребителей');
    const byType = new Map<number, number>();
    const byGroup = new Map<number, number>();
    for (const entry of allFixedEntries) {
      const item = itemById.get(entry.itemId);
      if (!item) continue;
      byType.set(item.id, (byType.get(item.id) ?? 0) + 1);
      byGroup.set(item.groupId, (byGroup.get(item.groupId) ?? 0) + 1);
    }
    for (const [typeId, count] of byType) {
      const item = itemById.get(typeId);
      if (item?.maxTypeFitted && count > item.maxTypeFitted) result.push(`${item.name}: разрешено не более ${item.maxTypeFitted}`);
    }
    for (const [groupId, count] of byGroup) {
      const item = data?.items.find((candidate) => candidate.groupId === groupId && candidate.maxGroupFitted > 0);
      if (item?.maxGroupFitted && count > item.maxGroupFitted) result.push(`${item.groupRu}: разрешено не более ${item.maxGroupFitted}`);
    }
    const subsystemSlots = new Map<number, number>();
    for (const entry of fitted?.subsystem ?? []) {
      if (!entry) continue;
      const subsystemSlot = itemById.get(entry.itemId)?.subsystemSlot ?? 0;
      if (subsystemSlot) subsystemSlots.set(subsystemSlot, (subsystemSlots.get(subsystemSlot) ?? 0) + 1);
    }
    if ([...subsystemSlots.values()].some((count) => count > 1)) {
      result.push('Установлено несколько подсистем одного назначения');
    }
    return [...new Set(result)];
  }, [allFixedEntries, data, fitted, itemById, selectedHull, totals]);

  function chooseHull(hull: FittingHull) {
    setSelectedHullId(hull.id);
    setHullKind(hull.kind);
    setFitName(`${hull.name} — новый фит`);
    setFitted(emptyRacks(hull));
    setSelectedSection(firstSection(hull));
    setSelectedSlotIndex(null);
    setItemQuery('');
    setSelectedSavedFitId(null);
  }

  function resetFit() {
    if (!selectedHull) return;
    setFitted(emptyRacks(selectedHull));
    setFitName(`${selectedHull.name} — новый фит`);
    setSelectedSlotIndex(null);
    setSelectedSavedFitId(null);
  }

  function saveCurrentFit() {
    if (!selectedHull || !fitted) return;
    const id = selectedSavedFitId ?? `fit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const preset: SavedFitPreset = {
      id,
      savedAt: new Date().toISOString(),
      hullId: selectedHull.id,
      fitName: fitName.trim() || `${selectedHull.name} — фит`,
      hullKind: selectedHull.kind,
      hullQuery: '',
      hullGroup: 'all',
      hullTech: 'all',
      itemQuery: '',
      itemGroup: 'all',
      itemLevel,
      itemPreference,
      selectedSection,
      fitted,
    };
    setSavedFits((current) => [preset, ...current.filter((fit) => fit.id !== id)].slice(0, 100));
    setSelectedSavedFitId(id);
    setSaveMessage('Фит сохранён в этом браузере.');
  }

  function loadSavedFit(preset: SavedFitPreset) {
    const hull = data?.hulls.find((candidate) => candidate.id === preset.hullId);
    if (!hull) return;
    setHullKind(hull.kind);
    setSelectedHullId(hull.id);
    setFitName(preset.fitName);
    setFitted(normalizeRacks(hull, preset.fitted));
    setSelectedSection(sectionAvailable(hull, preset.selectedSection) ? preset.selectedSection : firstSection(hull));
    setSelectedSlotIndex(null);
    setSelectedSavedFitId(preset.id);
    setHullQuery('');
    setHullGroup('all');
    setHullTech('all');
    setItemQuery('');
    setItemGroup('all');
    setItemLevel(typeof preset.itemLevel === 'string' ? preset.itemLevel : 'all');
    setItemPreference(preset.itemPreference === 'all' ? 'all' : 'recommended');
    setSavedFitsOpen(false);
  }

  function deleteSavedFit(id: string) {
    setSavedFits((current) => current.filter((fit) => fit.id !== id));
    if (selectedSavedFitId === id) setSelectedSavedFitId(null);
  }

  function addItem(item: FittingItem) {
    if (!fitted || !selectedHull || item.slot !== selectedSection || !itemFitsHull(item, selectedHull)) return;
    if (selectedSection === 'drone' || selectedSection === 'fighter') {
      setFitted((current) => {
        if (!current) return current;
        const entries = [...current[selectedSection]];
        const existingIndex = entries.findIndex((entry) => entry.itemId === item.id);
        if (existingIndex >= 0) entries[existingIndex] = { ...entries[existingIndex], quantity: (entries[existingIndex].quantity ?? 1) + 1 };
        else entries.push({ itemId: item.id, quantity: 1 });
        return { ...current, [selectedSection]: entries };
      });
      return;
    }
    const target = selectedSlotIndex !== null && !fitted[selectedSection][selectedSlotIndex]
      ? selectedSlotIndex
      : fitted[selectedSection].findIndex((entry) => !entry);
    if (target < 0) return;
    setFitted((current) => {
      if (!current) return current;
      const entries = [...current[selectedSection]];
      entries[target] = { itemId: item.id };
      return { ...current, [selectedSection]: entries };
    });
    const nextEmpty = fitted[selectedSection].findIndex((entry, index) => index > target && !entry);
    setSelectedSlotIndex(nextEmpty >= 0 ? nextEmpty : null);
  }

  function removeFixedItem(slot: SlotName, index: number) {
    setFitted((current) => {
      if (!current) return current;
      const entries = [...current[slot]];
      entries[index] = null;
      return { ...current, [slot]: entries };
    });
    setSelectedSection(slot);
    setSelectedSlotIndex(index);
  }

  function updateBayItem(section: 'drone' | 'fighter', itemId: number, delta: number) {
    setFitted((current) => {
      if (!current) return current;
      const entries = current[section]
        .map((entry) => entry.itemId === itemId ? { ...entry, quantity: (entry.quantity ?? 1) + delta } : entry)
        .filter((entry) => (entry.quantity ?? 1) > 0);
      return { ...current, [section]: entries };
    });
  }

  function compatibleCharges(item: FittingItem) {
    if (!data || !item.chargeGroupIds.length) return [];
    return data.charges.filter((charge) => item.chargeGroupIds.includes(charge.groupId)
      && (!item.chargeSize || !charge.chargeSize || item.chargeSize === charge.chargeSize));
  }

  function setCharge(slot: SlotName, index: number, chargeId: number | undefined) {
    setFitted((current) => {
      if (!current) return current;
      const entries = [...current[slot]];
      const entry = entries[index];
      if (entry) entries[index] = { ...entry, chargeId };
      return { ...current, [slot]: entries };
    });
  }

  function makeEft() {
    if (!selectedHull || !fitted) return '';
    const blocks: string[] = [];
    for (const slot of ['low', 'mid', 'high', 'rig', 'subsystem', 'service'] as SlotName[]) {
      if (!fitted[slot].length) continue;
      blocks.push(fitted[slot].map((entry) => {
        if (!entry) return `[Empty ${slot === 'mid' ? 'Med' : slot[0].toUpperCase() + slot.slice(1)} slot]`;
        const item = itemById.get(entry.itemId);
        return item ? fitLine(item, entry.chargeId ? chargeById.get(entry.chargeId) : undefined) : '';
      }).filter(Boolean).join('\n'));
    }
    const bayLines = [...fitted.drone, ...fitted.fighter].map((entry) => {
      const item = itemById.get(entry.itemId);
      return item ? `${item.name} x${entry.quantity ?? 1}` : '';
    }).filter(Boolean);
    if (bayLines.length) blocks.push(bayLines.join('\n'));
    return `[${selectedHull.name}, ${fitName.trim() || 'Новый фит'}]\n\n${blocks.join('\n\n')}`;
  }

  function openExport() {
    setExchangeText(makeEft());
    setExchangeMessage('');
    setCopied(false);
    setExchangeMode('export');
  }

  function openImport() {
    setExchangeText('');
    setExchangeMessage('');
    setExchangeMode('import');
  }

  async function copyEft() {
    try {
      await navigator.clipboard.writeText(exchangeText);
      setCopied(true);
    } catch {
      setExchangeMessage('Не удалось скопировать автоматически. Выделите текст вручную.');
    }
  }

  function importEft() {
    if (!data) return;
    const lines = exchangeText.replace(/\r/g, '').split('\n');
    const headerIndex = lines.findIndex((line) => line.trim().startsWith('['));
    const header = headerIndex >= 0 ? lines[headerIndex].trim().match(/^\[([^,\]]+)(?:,\s*(.*?))?\]$/) : null;
    if (!header) {
      setExchangeMessage('Не найдена строка [Корпус, название фита].');
      return;
    }
    const hullNeedle = header[1].trim().toLocaleLowerCase('en');
    const hull = data.hulls.find((candidate) => candidate.name.toLocaleLowerCase('en') === hullNeedle
      || candidate.nameRu.toLocaleLowerCase('ru') === hullNeedle);
    if (!hull) {
      setExchangeMessage(`Корпус «${header[1].trim()}» отсутствует в справочнике.`);
      return;
    }
    const racks = emptyRacks(hull);
    const skipped: string[] = [];
    for (const sourceLine of lines.slice(headerIndex + 1)) {
      const line = sourceLine.trim();
      if (!line || /^\[Empty .+ slot\]$/i.test(line)) continue;
      const quantityMatch = line.match(/\s+x(\d+)$/i);
      const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[1])) : 1;
      const withoutQuantity = quantityMatch ? line.slice(0, quantityMatch.index).trim() : line;
      const [itemName, chargeName] = withoutQuantity.split(',').map((part) => part.trim());
      const item = itemByName.get(itemName.toLocaleLowerCase('en'));
      if (!item || !itemFitsHull(item, hull) || !sectionAvailable(hull, item.slot)) {
        skipped.push(itemName);
        continue;
      }
      if (item.slot === 'drone' || item.slot === 'fighter') {
        const existing = racks[item.slot].find((entry) => entry.itemId === item.id);
        if (existing) existing.quantity = (existing.quantity ?? 1) + quantity;
        else racks[item.slot].push({ itemId: item.id, quantity });
        continue;
      }
      const target = racks[item.slot].findIndex((entry) => !entry);
      if (target < 0) {
        skipped.push(itemName);
        continue;
      }
      const charge = chargeName ? chargeByName.get(chargeName.toLocaleLowerCase('en')) : undefined;
      racks[item.slot][target] = { itemId: item.id, chargeId: charge?.id };
    }
    setHullKind(hull.kind);
    setSelectedHullId(hull.id);
    setFitName(header[2]?.trim() || `${hull.name} — импорт`);
    setFitted(racks);
    setSelectedSection(firstSection(hull));
    setSelectedSlotIndex(null);
    setHullQuery('');
    setHullGroup('all');
    setHullTech('all');
    setItemQuery('');
    setItemGroup('all');
    setItemLevel('all');
    setItemPreference('recommended');
    setSelectedSavedFitId(null);
    setExchangeMessage(skipped.length
      ? `Фит загружен. Пропущено позиций: ${skipped.length} (${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}).`
      : 'Фит успешно загружен.');
    if (!skipped.length) setExchangeMode(null);
  }

  if (loadError) {
    return (
      <div className="fit-status">
        <AlertTriangle aria-hidden="true" />
        <h2>Не удалось загрузить данные фитинга</h2>
        <p>Обновите страницу и попробуйте ещё раз.</p>
      </div>
    );
  }

  if (!data || !selectedHull || !fitted) {
    return (
      <div className="fit-status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Загружаю корпуса и оборудование…</p>
      </div>
    );
  }

  const activeRack = selectedSection === 'drone' || selectedSection === 'fighter'
    ? fitted[selectedSection]
    : fitted[selectedSection];

  return (
    <div className="fit-workspace-grid">
      <section className="tree-panel fit-hull-panel" aria-labelledby="fit-hull-title">
        <div className="panel-head">
          <div><span className="step-number">01</span><h2 id="fit-hull-title">Корпус</h2></div>
          <span className="result-count">{filteredHulls.length}</span>
        </div>
        <div className="fit-kind-switch" role="group" aria-label="Тип корпуса">
          <button type="button" className={hullKind === 'ship' ? 'is-active' : ''} onClick={() => { setHullKind('ship'); setHullQuery(''); setHullGroup('all'); setHullTech('all'); }}>
            <ShipWheel aria-hidden="true" />Корабли
          </button>
          <button type="button" className={hullKind === 'structure' ? 'is-active' : ''} onClick={() => { setHullKind('structure'); setHullQuery(''); setHullGroup('all'); setHullTech('all'); }}>
            <Box aria-hidden="true" />Сооружения
          </button>
        </div>
        <label className="search-box fit-search">
          <Search aria-hidden="true" />
          <Input value={hullQuery} onChange={(event) => setHullQuery(event.target.value)} placeholder="Корпус или класс" aria-label="Поиск корпуса" />
        </label>
        <div className="fit-hull-filters">
          <NativeSelect value={hullGroup} onChange={(event) => setHullGroup(event.target.value)} aria-label={hullKind === 'ship' ? 'Класс корабля' : 'Тип сооружения'}>
            <NativeSelectOption value="all">{hullKind === 'ship' ? 'Все классы' : 'Все типы'} · {hullsForKind.length}</NativeSelectOption>
            {hullGroups.map((group) => <NativeSelectOption value={String(group.id)} key={group.id}>{group.name} · {group.count}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect value={hullTech} onChange={(event) => setHullTech(event.target.value)} aria-label="Технологический уровень корпуса">
            <NativeSelectOption value="all">Все техуровни · {hullsForKind.length}</NativeSelectOption>
            {hullTechLevels.map(([level, count]) => <NativeSelectOption value={String(level)} key={level}>Техуровень {level} · {count}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="fit-hull-list" role="listbox" aria-label="Корпуса для фитинга">
          {filteredHulls.map((hull) => (
            <button type="button" role="option" aria-selected={hull.id === selectedHull.id} className="fit-hull-row" key={hull.id} onClick={() => chooseHull(hull)}>
              <img src={iconUrl(hull.id)} alt="" loading="lazy" />
              <span><strong>{displayName(hull)}</strong><small>{hull.groupRu} · ID {hull.id}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
          {!filteredHulls.length && <p className="empty-note">Корпуса не найдены</p>}
        </div>
      </section>

      <section className="tree-panel fit-builder-panel" aria-labelledby="fit-builder-title">
        <div className="fit-builder-head">
          <div className="fit-selected-hull">
            <img src={iconUrl(selectedHull.id)} alt="" />
            <div>
              <span className="eyebrow">{selectedHull.kind === 'ship' ? 'Корабль' : 'Сооружение'} · {selectedHull.groupRu}</span>
              <h2 id="fit-builder-title">{displayName(selectedHull)}</h2>
              <p>{fixedSlots.filter((slot) => selectedHull.slots[slot] > 0).map((slot) => `${slotShortLabels[slot]} ${selectedHull.slots[slot]}`).join(' · ')}</p>
            </div>
          </div>
          <label className="fit-name-field">
            <span>Название фита</span>
            <Input value={fitName} onChange={(event) => setFitName(event.target.value)} aria-label="Название фита" />
          </label>
          <div className="fit-actions">
            <Button type="button" variant="outline" onClick={saveCurrentFit}><Save />{selectedSavedFitId ? 'Обновить' : 'Сохранить'}</Button>
            <Button type="button" variant="outline" onClick={() => setSavedFitsOpen(true)}><FolderOpen />Мои фиты {savedFits.length ? `(${savedFits.length})` : ''}</Button>
            <Button type="button" variant="outline" onClick={openImport}><Upload />Импорт EFT</Button>
            <Button type="button" variant="outline" onClick={openExport}><Download />Экспорт EFT</Button>
            <Button type="button" variant="ghost" onClick={resetFit} aria-label="Очистить фит"><RotateCcw /></Button>
          </div>
        </div>

        <div className="fit-resource-grid">
          <ResourceMeter icon={<Cpu />} label="ЦПУ" used={totals.cpu} total={selectedHull.resources.cpu} />
          <ResourceMeter icon={<Zap />} label="Энергосеть" used={totals.powergrid} total={selectedHull.resources.powergrid} suffix=" МВт" />
          <ResourceMeter icon={<CircleGauge />} label="Калибровка" used={totals.calibration} total={selectedHull.resources.calibration} />
          <div className="fit-hardpoints">
            <span><Crosshair />Турели <b className={totals.turrets > selectedHull.resources.turrets ? 'is-exceeded' : ''}>{totals.turrets}/{selectedHull.resources.turrets}</b></span>
            <span><Gauge />Пусковые <b className={totals.launchers > selectedHull.resources.launchers ? 'is-exceeded' : ''}>{totals.launchers}/{selectedHull.resources.launchers}</b></span>
          </div>
        </div>

        <div className={`fit-validation ${violations.length ? 'has-errors' : ''}`}>
          {violations.length ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
          <div>
            <strong>{violations.length ? `${violations.length} проблем в базовой проверке` : 'Базовые ограничения соблюдены'}</strong>
            <span>{violations.length ? violations.join(' · ') : 'Слоты, ресурсы, точки установки и размеры ригов проверены.'}</span>
          </div>
          <Badge variant="outline">{totals.skills} навыков</Badge>
        </div>

        <div className="fit-editor-grid">
          <div className="fit-racks">
            {fixedSlots.map((slot) => selectedHull.slots[slot] > 0 && (
              <section className={`fit-rack fit-rack-${slot} ${selectedSection === slot ? 'is-active' : ''}`} key={slot}>
                <button type="button" className="fit-rack-head" onClick={() => setSelectedSection(slot)}>
                  <span><SectionIcon section={slot} /><b>{slotLabels[slot]}</b></span>
                  <small>{fitted[slot].filter(Boolean).length} / {selectedHull.slots[slot]}</small>
                </button>
                <div className="fit-slot-list">
                  {fitted[slot].map((entry, index) => {
                    const item = entry ? itemById.get(entry.itemId) : undefined;
                    const charges = item ? compatibleCharges(item) : [];
                    return (
                      <div
                        className={`fit-slot ${selectedSection === slot && selectedSlotIndex === index ? 'is-selected' : ''} ${item ? 'is-filled' : ''}`}
                        key={`${slot}-${index}`}
                        onMouseEnter={item ? (event) => showItemTooltip(item, event) : undefined}
                        onMouseMove={item ? moveItemTooltip : undefined}
                        onMouseLeave={item ? () => setTooltipItem(null) : undefined}
                        onFocus={item ? (event) => focusItemTooltip(item, event) : undefined}
                        onBlur={item ? () => setTooltipItem(null) : undefined}
                      >
                        {item ? (
                          <>
                            <img src={iconUrl(item.id)} alt="" loading="lazy" />
                            <div className="fit-slot-copy">
                              <strong>{displayName(item)}</strong>
                              <span>{item.groupRu} · {numberFormat.format(item.cpu)} ЦПУ · {numberFormat.format(item.powergrid)} МВт</span>
                              {charges.length > 0 && (
                                <NativeSelect value={entry?.chargeId ? String(entry.chargeId) : ''} onChange={(event) => setCharge(slot, index, event.target.value ? Number(event.target.value) : undefined)} aria-label={`Заряд для ${item.name}`}>
                                  <NativeSelectOption value="">Без заряда</NativeSelectOption>
                                  {charges.map((charge) => <NativeSelectOption value={String(charge.id)} key={charge.id}>{displayName(charge)}</NativeSelectOption>)}
                                </NativeSelect>
                              )}
                            </div>
                            <button type="button" className="fit-remove" onClick={() => removeFixedItem(slot, index)} aria-label={`Снять ${item.name}`}><X /></button>
                          </>
                        ) : (
                          <button type="button" className="fit-empty-slot" onClick={() => { setSelectedSection(slot); setSelectedSlotIndex(index); }}>
                            <Plus aria-hidden="true" /><span>{slotShortLabels[slot]} {index + 1}</span><small>Выберите модуль справа</small>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {(['drone', 'fighter'] as const).map((section) => sectionAvailable(selectedHull, section) && (
              <section className={`fit-rack fit-rack-${section} ${selectedSection === section ? 'is-active' : ''}`} key={section}>
                <button type="button" className="fit-rack-head" onClick={() => setSelectedSection(section)}>
                  <span><SectionIcon section={section} /><b>{slotLabels[section]}</b></span>
                  <small>{numberFormat.format(section === 'drone' ? totals.droneBay : totals.fighterBay)} / {numberFormat.format(section === 'drone' ? selectedHull.resources.droneBay : selectedHull.resources.fighterBay)} м³</small>
                </button>
                <div className="fit-bay-list">
                  {fitted[section].map((entry) => {
                    const item = itemById.get(entry.itemId);
                    if (!item) return null;
                    return (
                      <div
                        className="fit-bay-row"
                        key={entry.itemId}
                        onMouseEnter={(event) => showItemTooltip(item, event)}
                        onMouseMove={moveItemTooltip}
                        onMouseLeave={() => setTooltipItem(null)}
                        onFocus={(event) => focusItemTooltip(item, event)}
                        onBlur={() => setTooltipItem(null)}
                      >
                        <img src={iconUrl(item.id)} alt="" loading="lazy" />
                        <span><strong>{displayName(item)}</strong><small>{numberFormat.format(item.volume)} м³{section === 'drone' ? ` · ${numberFormat.format(item.bandwidth)} Мбит/с` : ''}</small></span>
                        <div><button type="button" onClick={() => updateBayItem(section, item.id, -1)} aria-label="Уменьшить"><Minus /></button><b>{entry.quantity ?? 1}</b><button type="button" onClick={() => updateBayItem(section, item.id, 1)} aria-label="Увеличить"><Plus /></button></div>
                      </div>
                    );
                  })}
                  {!fitted[section].length && <button type="button" className="fit-empty-bay" onClick={() => setSelectedSection(section)}><Plus />Добавить {section === 'drone' ? 'дроны' : 'истребители'}</button>}
                </div>
              </section>
            ))}
          </div>

          <aside className="fit-item-browser" aria-label="Библиотека оборудования">
            <div className="fit-item-browser-head">
              <div><span className="step-number">02</span><h3>{slotLabels[selectedSection]}</h3></div>
              <span>{filteredItems.length}</span>
            </div>
            <label className="search-box fit-item-search">
              <Search aria-hidden="true" />
              <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Название оборудования" aria-label="Поиск оборудования" />
            </label>
            <div className="fit-preference-filter">
              <NativeSelect value={itemPreference} onChange={(event) => setItemPreference(event.target.value === 'all' ? 'all' : 'recommended')} aria-label="Предпочтения оборудования">
                <NativeSelectOption value="recommended">Рекомендуемое для корпуса · {preferredItems.length}</NativeSelectOption>
                <NativeSelectOption value="all">Всё технически совместимое · {compatibleItems.length}</NativeSelectOption>
              </NativeSelect>
              <small>{itemPreference === 'recommended' ? 'Учтены бонусы корпуса, назначение и орудийные точки' : 'Показано всё оборудование, которое можно установить'}</small>
            </div>
            <div className="fit-item-filters">
              <NativeSelect value={itemGroup} onChange={(event) => setItemGroup(event.target.value)} aria-label="Группа оборудования">
                <NativeSelectOption value="all">Все группы · {levelFilteredItems.length}</NativeSelectOption>
                {itemGroups.map((group) => <NativeSelectOption value={String(group.id)} key={group.id}>{group.name} · {group.count}</NativeSelectOption>)}
              </NativeSelect>
              <NativeSelect value={itemLevel} onChange={(event) => setItemLevel(event.target.value)} aria-label="Уровень оборудования">
                <NativeSelectOption value="all">Все уровни · {itemsForLevelOptions.length}</NativeSelectOption>
                {itemLevels.map((level) => <NativeSelectOption value={String(level.id)} key={level.id}>{level.name} · {level.count}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="fit-item-list">
              {filteredItems.slice(0, 400).map((item, index, visibleItems) => {
                const fixedFull = selectedSection !== 'drone' && selectedSection !== 'fighter' && activeRack.every(Boolean) && selectedSlotIndex === null;
                return (
                  <Fragment key={item.id}>
                    {(index === 0 || visibleItems[index - 1].metaGroupId !== item.metaGroupId) && (
                      <div className="fit-item-level-heading"><span>{item.metaGroupRu}</span><b>{filteredItemLevelCounts.get(item.metaGroupId) ?? 0}</b></div>
                    )}
                    <button
                      type="button"
                      className="fit-item-row"
                      onClick={() => addItem(item)}
                      onMouseEnter={(event) => showItemTooltip(item, event)}
                      onMouseMove={moveItemTooltip}
                      onMouseLeave={() => setTooltipItem(null)}
                      onFocus={(event) => focusItemTooltip(item, event)}
                      onBlur={() => setTooltipItem(null)}
                      disabled={fixedFull}
                    >
                      <img src={iconUrl(item.id)} alt="" loading="lazy" />
                      <span><strong>{displayName(item)}</strong><small>{item.groupRu} · {item.metaGroupRu}</small><em>{item.slot !== 'drone' && item.slot !== 'fighter' ? `${numberFormat.format(item.cpu)} ЦПУ · ${numberFormat.format(item.powergrid)} МВт${item.calibration ? ` · ${item.calibration} кал.` : ''}` : `${numberFormat.format(item.volume)} м³`}</em></span>
                      <Plus aria-hidden="true" />
                    </button>
                  </Fragment>
                );
              })}
              {filteredItems.length > 400 && <p className="fit-list-note">Показаны первые 400 позиций. Уточните название или группу.</p>}
              {!filteredItems.length && <p className="empty-note">Совместимое оборудование не найдено</p>}
            </div>
          </aside>
        </div>

        <div className="fit-summary-strip">
          <span><Shield />Базовая защита</span>
          <b>{numberFormat.format(selectedHull.defenses.shield)} щит</b>
          <b>{numberFormat.format(selectedHull.defenses.armor)} броня</b>
          <b>{numberFormat.format(selectedHull.defenses.hull)} корпус</b>
          <small>Расчёт эффектов модулей и навыков будет добавлен следующим уровнем.</small>
        </div>
      </section>

      {tooltipItem && typeof document !== 'undefined' && createPortal(
        <div className="fit-item-tooltip" ref={tooltipRef} role="tooltip">
          <div className="fit-item-tooltip-head">
            <img src={iconUrl(tooltipItem.id)} alt="" />
            <div>
              <span>{slotLabels[tooltipItem.slot]} · {tooltipItem.groupRu} · {tooltipItem.metaGroupRu}</span>
              <strong>{displayName(tooltipItem)}</strong>
              {tooltipItem.nameRu !== tooltipItem.name && <small>{tooltipItem.name}</small>}
            </div>
          </div>
          <p>{tooltipItem.description || 'Краткое описание этого предмета отсутствует в EVE SDE.'}</p>
          <div className="fit-item-tooltip-stats">
            {tooltipItem.cpu > 0 && <span><b>{numberFormat.format(tooltipItem.cpu)}</b> ЦПУ</span>}
            {tooltipItem.powergrid > 0 && <span><b>{numberFormat.format(tooltipItem.powergrid)}</b> МВт</span>}
            {tooltipItem.calibration > 0 && <span><b>{numberFormat.format(tooltipItem.calibration)}</b> калибровки</span>}
            {tooltipItem.volume > 0 && <span><b>{numberFormat.format(tooltipItem.volume)}</b> м³</span>}
            {tooltipItem.bandwidth > 0 && <span><b>{numberFormat.format(tooltipItem.bandwidth)}</b> Мбит/с</span>}
            {tooltipItem.rigSize > 0 && <span>Размер рига <b>{tooltipItem.rigSize}</b></span>}
            {tooltipItem.metaLevel > 0 && <span>Мета-уровень <b>{numberFormat.format(tooltipItem.metaLevel)}</b></span>}
            {tooltipItem.techLevel > 1 && <span>Техуровень <b>{tooltipItem.techLevel}</b></span>}
          </div>
          {(tooltipItem.turret || tooltipItem.launcher) && (
            <div className="fit-item-tooltip-tags">
              {tooltipItem.turret && <span>Турель</span>}
              {tooltipItem.launcher && <span>Пусковая установка</span>}
            </div>
          )}
          {tooltipItem.effects?.length > 0 && (
            <div className="fit-item-tooltip-effects">
              <span>Основные эффекты</span>
              <div>
                {tooltipItem.effects.slice(0, 6).map((effect) => {
                  const formatted = formatDogmaEffect(effect);
                  return (
                    <p key={effect.attributeId}>
                      <small>{effect.label}</small>
                      <strong className={formatted.tone}>{formatted.value}</strong>
                    </p>
                  );
                })}
              </div>
            </div>
          )}
          {tooltipItem.skills.length > 0 && (
            <div className="fit-item-tooltip-skills">
              <span>Требуемые навыки</span>
              <strong>{tooltipItem.skills.slice(0, 4).map((skill) => `${skill.name} ${skill.level}`).join(' · ')}{tooltipItem.skills.length > 4 ? ` · ещё ${tooltipItem.skills.length - 4}` : ''}</strong>
            </div>
          )}
        </div>,
        document.body,
      )}

      <Dialog open={exchangeMode !== null} onOpenChange={(open) => { if (!open) setExchangeMode(null); }}>
        <DialogContent className="fit-exchange-dialog">
          <DialogHeader>
            <DialogTitle>{exchangeMode === 'import' ? 'Импорт EFT-фита' : 'Экспорт EFT-фита'}</DialogTitle>
            <DialogDescription>
              {exchangeMode === 'import'
                ? 'Вставьте фит из игры или Pyfa. Корпус, модули, заряды, дроны и истребители будут восстановлены.'
                : 'Этот текст можно вставить в окно импорта фитинга EVE Online или Pyfa.'}
            </DialogDescription>
          </DialogHeader>
          <textarea value={exchangeText} onChange={(event) => setExchangeText(event.target.value)} readOnly={exchangeMode === 'export'} spellCheck={false} aria-label="Фит в формате EFT" />
          {exchangeMessage && <p className="fit-exchange-message"><AlertTriangle />{exchangeMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExchangeMode(null)}>Закрыть</Button>
            {exchangeMode === 'import' ? (
              <Button type="button" onClick={importEft}><Upload />Загрузить фит</Button>
            ) : (
              <Button type="button" onClick={copyEft}>{copied ? <Check /> : <Clipboard />}{copied ? 'Скопировано' : 'Скопировать'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savedFitsOpen} onOpenChange={setSavedFitsOpen}>
        <DialogContent className="fit-exchange-dialog fit-saved-dialog">
          <DialogHeader>
            <DialogTitle>Мои фиты</DialogTitle>
            <DialogDescription>Фиты хранятся локально в этом браузере.</DialogDescription>
          </DialogHeader>
          {saveMessage && <p className="fit-save-message"><Check />{saveMessage}</p>}
          <div className="fit-saved-list">
            {savedFits.map((preset) => {
              const hull = data.hulls.find((candidate) => candidate.id === preset.hullId);
              return (
                <div className={preset.id === selectedSavedFitId ? 'is-selected' : ''} key={preset.id}>
                  <img src={iconUrl(preset.hullId)} alt="" />
                  <button type="button" onClick={() => loadSavedFit(preset)}>
                    <strong>{preset.fitName}</strong>
                    <span>{hull ? `${displayName(hull)} · ${hull.groupRu}` : `ID ${preset.hullId}`}</span>
                  </button>
                  <button type="button" className="fit-saved-delete" onClick={() => deleteSavedFit(preset.id)} aria-label={`Удалить ${preset.fitName}`}><Trash2 /></button>
                </div>
              );
            })}
            {!savedFits.length && <div className="fit-saved-empty"><PackageOpen /><p>Сохранённых фитов пока нет</p></div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSavedFitsOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
