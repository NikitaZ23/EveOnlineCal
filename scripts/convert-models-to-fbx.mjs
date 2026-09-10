import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceCandidates = [
  path.resolve(projectRoot, '..', '3d-models', 'EVE_Model_Gallery', 'docs'),
  path.resolve('E:/AI/Projects/EveOnlineCal/3d-models/EVE_Model_Gallery/docs'),
];
const defaultSource = sourceCandidates.find((candidate) => fsSync.existsSync(candidate)) ?? sourceCandidates[0];
const defaultOutput = path.resolve(defaultSource, '..', '..', 'FBX_UE5');

function printHelp() {
  console.log(`Конвертация GLB-моделей EVE в FBX для Unreal Engine 5

Использование:
  npm run convert:models:fbx -- [параметры]

Параметры:
  --blender <путь>      Путь к blender.exe. Можно задать BLENDER_EXE.
  --source <каталог>    Каталог docs из EVE_Model_Gallery.
  --output <каталог>    Каталог для FBX, PNG-текстур и манифестов.
  --type-id <ID,...>    Конвертировать только указанные typeID.
  --limit <число>       Ограничить количество уникальных моделей.
  --batch-size <число>  Моделей на один запуск Blender (по умолчанию 20).
  --scale <число>       Масштаб экспорта FBX (по умолчанию 1).
  --force               Перезаписать уже готовые FBX.
  --dry-run             Только проверить входные файлы и показать план.
  --help                Показать справку.

По умолчанию:
  источник: ${defaultSource}
  результат: ${defaultOutput}`);
}

function parseArguments(argv) {
  const options = {
    blender: process.env.BLENDER_EXE || '',
    source: defaultSource,
    output: defaultOutput,
    typeIds: new Set(),
    limit: 0,
    batchSize: 20,
    scale: 1,
    force: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Не задано значение для ${argument}`);
      index += 1;
      return value;
    };

    if (argument === '--blender') options.blender = nextValue();
    else if (argument === '--source') options.source = nextValue();
    else if (argument === '--output') options.output = nextValue();
    else if (argument === '--type-id') {
      for (const value of nextValue().split(',')) {
        const typeId = Number(value.trim());
        if (!Number.isInteger(typeId) || typeId <= 0) throw new Error(`Некорректный typeID: ${value}`);
        options.typeIds.add(typeId);
      }
    } else if (argument === '--limit') options.limit = Number(nextValue());
    else if (argument === '--batch-size') options.batchSize = Number(nextValue());
    else if (argument === '--scale') options.scale = Number(nextValue());
    else if (argument === '--force') options.force = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Неизвестный параметр: ${argument}`);
  }

  if (!Number.isInteger(options.limit) || options.limit < 0) throw new Error('--limit должен быть целым неотрицательным числом');
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) throw new Error('--batch-size должен быть положительным целым числом');
  if (!Number.isFinite(options.scale) || options.scale <= 0) throw new Error('--scale должен быть положительным числом');
  options.source = path.resolve(options.source);
  options.output = path.resolve(options.output);
  return options;
}

function isFile(filePath) {
  try {
    return fsSync.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function blenderCandidates() {
  const candidates = [];
  if (process.platform === 'win32') {
    try {
      const result = spawnSync('where.exe', ['blender'], { encoding: 'utf8', windowsHide: true });
      if (result.status === 0) candidates.push(...result.stdout.split(/\r?\n/).filter(Boolean));
    } catch {
      // Blender may not be registered in PATH.
    }

    const roots = [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Blender Foundation'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Blender Foundation'),
    ].filter(Boolean);
    for (const root of roots) {
      try {
        for (const entry of fsSync.readdirSync(root, { withFileTypes: true })) {
          if (entry.isDirectory()) candidates.push(path.join(root, entry.name, 'blender.exe'));
        }
      } catch {
        // Candidate directory is optional.
      }
    }

    candidates.push(
      'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe',
      'C:/Program Files/Steam/steamapps/common/Blender/blender.exe',
    );
    try {
      const result = spawnSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const steamPath = result.stdout.match(/SteamPath\s+REG_\w+\s+(.+)$/im)?.[1]?.trim();
      if (steamPath) candidates.push(path.join(steamPath, 'steamapps', 'common', 'Blender', 'blender.exe'));
    } catch {
      // Steam installation is optional.
    }
  } else {
    try {
      const result = spawnSync('which', ['blender'], { encoding: 'utf8' });
      if (result.status === 0) candidates.push(result.stdout.trim());
    } catch {
      // Blender may not be registered in PATH.
    }
  }
  return candidates;
}

function resolveBlender(explicitPath) {
  const candidates = [explicitPath, ...blenderCandidates()].filter(Boolean).map((candidate) => path.resolve(candidate));
  const blender = candidates.find(isFile);
  if (!blender) {
    throw new Error('Blender не найден. Укажите путь: --blender "C:\\...\\blender.exe" или задайте переменную BLENDER_EXE.');
  }
  return blender;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function runBlender(blender, pythonScript, jobsFile, reportFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      blender,
      ['--background', '--factory-startup', '--python', pythonScript, '--', '--jobs', jobsFile, '--report', reportFile],
      { stdio: 'inherit', windowsHide: true, env: { ...process.env, PYTHONUTF8: '1' } },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function writeManifest(output, sourceRoot, catalog, selectedEntries, jobsByPath, reports) {
  const reportBySource = new Map(reports.map((report) => [path.normalize(report.source), report]));
  const models = {};
  for (const [typeId, model] of selectedEntries) {
    const job = jobsByPath.get(model.path);
    const report = reportBySource.get(path.normalize(job.source));
    const ready = isFile(job.output);
    models[typeId] = {
      name: model.name,
      category: model.category,
      group: model.group,
      source: model.path,
      fbx: ready ? path.relative(output, job.output).replaceAll(path.sep, '/') : null,
      materials: ready ? path.relative(output, job.materialManifest).replaceAll(path.sep, '/') : null,
      status: report?.status ?? (ready ? 'ready' : 'pending'),
      error: report?.error ?? null,
    };
  }
  const manifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceCatalog: catalog.meta?.source ?? null,
      sourceRoot,
      catalogEntries: selectedEntries.length,
      uniqueModels: jobsByPath.size,
      readyModels: [...jobsByPath.values()].filter((job) => isFile(job.output)).length,
      coordinateSystem: 'Unreal Engine: -Y Forward, Z Up',
      globalScale: [...jobsByPath.values()][0]?.globalScale ?? 1,
    },
    models,
  };
  await fs.writeFile(path.join(output, 'fbx-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const catalogPath = path.join(projectRoot, 'public', 'eve-3d-models.json');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  let selectedEntries = Object.entries(catalog.models);
  if (options.typeIds.size) {
    const missingIds = [...options.typeIds].filter((typeId) => !catalog.models[typeId]);
    if (missingIds.length) throw new Error(`typeID отсутствуют в каталоге: ${missingIds.join(', ')}`);
    selectedEntries = selectedEntries.filter(([typeId]) => options.typeIds.has(Number(typeId)));
  }

  const bySourcePath = new Map();
  for (const [typeId, model] of selectedEntries) {
    if (!bySourcePath.has(model.path)) bySourcePath.set(model.path, { model, typeIds: [] });
    bySourcePath.get(model.path).typeIds.push(Number(typeId));
  }
  let uniqueEntries = [...bySourcePath.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (options.limit) uniqueEntries = uniqueEntries.slice(0, options.limit);
  const selectedPaths = new Set(uniqueEntries.map(([modelPath]) => modelPath));
  selectedEntries = selectedEntries.filter(([, model]) => selectedPaths.has(model.path));

  const jobs = uniqueEntries.map(([modelPath, details]) => {
    const source = path.resolve(options.source, modelPath);
    if (!isInside(options.source, source)) throw new Error(`Путь модели выходит за пределы источника: ${modelPath}`);
    const relativeStem = modelPath.replace(/\.glb$/i, '');
    const modelOutput = path.resolve(options.output, relativeStem);
    if (!isInside(options.output, modelOutput)) throw new Error(`Некорректный путь результата: ${modelPath}`);
    const stem = path.basename(relativeStem);
    return {
      source,
      output: path.join(modelOutput, `${stem}.fbx`),
      textureDir: path.join(modelOutput, 'Textures'),
      materialManifest: path.join(modelOutput, 'materials.json'),
      sourcePath: modelPath,
      typeIds: details.typeIds,
      name: details.model.name,
      globalScale: options.scale,
      force: options.force,
    };
  });
  const jobsByPath = new Map(jobs.map((job) => [job.sourcePath, job]));
  const missingFiles = jobs.filter((job) => !isFile(job.source));
  if (missingFiles.length) {
    throw new Error(`Не найдено GLB-файлов: ${missingFiles.length}. Первый: ${missingFiles[0].source}`);
  }

  const sourceBytes = jobs.reduce((sum, job) => sum + fsSync.statSync(job.source).size, 0);
  const pending = jobs.filter((job) => options.force || !isFile(job.output));
  console.log(`Записей typeID: ${selectedEntries.length}`);
  console.log(`Уникальных GLB: ${jobs.length}`);
  console.log(`Объём исходников: ${(sourceBytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`);
  console.log(`К конвертации: ${pending.length}; уже готовы: ${jobs.length - pending.length}`);
  console.log(`Результат: ${options.output}`);
  console.log('Модели EVE и связанные материалы принадлежат CCP hf.; исходный каталог помечает их для некоммерческого использования.');

  if (options.dryRun) return;
  await fs.mkdir(options.output, { recursive: true });
  if (!pending.length) {
    await writeManifest(options.output, options.source, catalog, selectedEntries, jobsByPath, []);
    console.log('Все выбранные модели уже сконвертированы. Манифест обновлён.');
    return;
  }
  const blender = resolveBlender(options.blender);
  console.log(`Blender: ${blender}`);
  const pythonScript = path.join(projectRoot, 'scripts', 'blender-export-fbx.py');
  const workDirectory = path.join(options.output, '.work');
  await fs.mkdir(workDirectory, { recursive: true });
  const reports = [];

  for (const [batchIndex, batch] of chunks(pending, options.batchSize).entries()) {
    const jobFile = path.join(workDirectory, `jobs-${String(batchIndex + 1).padStart(4, '0')}.json`);
    const reportFile = path.join(workDirectory, `report-${String(batchIndex + 1).padStart(4, '0')}.json`);
    await fs.writeFile(jobFile, `${JSON.stringify(batch, null, 2)}\n`, 'utf8');
    console.log(`\nПакет ${batchIndex + 1}/${Math.ceil(pending.length / options.batchSize)}: ${batch.length} моделей`);
    const exitCode = await runBlender(blender, pythonScript, jobFile, reportFile);
    try {
      const batchReport = JSON.parse(await fs.readFile(reportFile, 'utf8'));
      reports.push(...batchReport);
    } catch (error) {
      reports.push(...batch.map((job) => ({ source: job.source, output: job.output, status: 'failed', error: `Blender не создал отчёт: ${error.message}` })));
    }
    await writeManifest(options.output, options.source, catalog, selectedEntries, jobsByPath, reports);
    if (exitCode !== 0) console.error(`Пакет завершён с ошибками (код Blender ${exitCode}). Конвертация продолжена.`);
  }

  await writeManifest(options.output, options.source, catalog, selectedEntries, jobsByPath, reports);
  await fs.writeFile(path.join(options.output, 'conversion-report.json'), `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
  const failed = reports.filter((report) => report.status === 'failed');
  const ready = jobs.filter((job) => isFile(job.output)).length;
  console.log(`\nГотово FBX: ${ready}/${jobs.length}. Ошибок в этом запуске: ${failed.length}.`);
  if (failed.length) {
    console.error(`Первая ошибка: ${failed[0].source}: ${failed[0].error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
