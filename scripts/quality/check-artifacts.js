#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveImagePath } from '../utils/image-artifacts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const EXERCISES_ROOT = path.join(ROOT, 'content/exercises');
const CONTENT_ROOT = path.join(ROOT, 'content');
const ARTIFACTS_ROOT = path.join(ROOT, 'static/artifacts');
const STATIC_ROOT = path.join(ROOT, 'static');

function withoutComments(source) {
  return source.replace(/(?<!\\)%.*$/gm, '');
}

export function extractIncludegraphicsPaths(source) {
  const paths = [];
  const regex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
  const uncommented = withoutComments(source);
  let match;

  while ((match = regex.exec(uncommented)) !== null) {
    paths.push(match[1].trim());
  }

  return paths;
}

async function listTexFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTexFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tex') ? [entryPath] : [];
  }));
  return nested.flat();
}

async function readArtifact(uuid, artifactsRoot) {
  try {
    return JSON.parse(await fs.readFile(path.join(artifactsRoot, `${uuid}.json`), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function issue(entry, code, message) {
  return { filePath: entry.filePath, uuid: entry.uuid, imagePath: entry.imagePath, code, message };
}

/**
 * Vérifie qu'une image résoluble depuis la source est bien déclarée dans son
 * manifeste d'artefacts et présente dans static/.
 */
export async function validateArtifactReferences(entries, {
  contentRoot = CONTENT_ROOT,
  artifactsRoot = ARTIFACTS_ROOT,
  staticRoot = STATIC_ROOT
} = {}) {
  const issues = [];
  const manifests = new Map();
  const silentLogger = { info() {}, warn() {} };

  for (const entry of entries) {
    const resolvedSource = await resolveImagePath({
      imagePath: entry.imagePath,
      sourceFilePath: entry.sourceFilePath,
      contentRoot,
      logger: silentLogger
    });
    if (!resolvedSource) {
      issues.push(issue(entry, 'missing-source-image', `Image source introuvable : ${entry.imagePath}`));
      continue;
    }

    if (!manifests.has(entry.uuid)) {
      manifests.set(entry.uuid, await readArtifact(entry.uuid, artifactsRoot));
    }
    const manifest = manifests.get(entry.uuid);
    if (!manifest) {
      issues.push(issue(entry, 'missing-artifact-manifest', `Manifeste d'artefacts absent : ${entry.uuid}.json`));
      continue;
    }

    const artifact = manifest.images?.find(image => image.originalPath === entry.imagePath);
    if (!artifact) {
      issues.push(issue(entry, 'missing-artifact-record', `Image absente du manifeste d'artefacts : ${entry.imagePath}`));
      continue;
    }

    const publicPath = String(artifact.url || '');
    if (!publicPath.startsWith('/artifacts/images/')) {
      issues.push(issue(entry, 'invalid-artifact-url', `URL d'artefact invalide : ${publicPath || '(vide)'}`));
      continue;
    }

    const artifactPath = path.join(staticRoot, publicPath.slice(1));
    try {
      await fs.access(artifactPath);
    } catch {
      issues.push(issue(entry, 'missing-artifact-file', `Fichier d'artefact absent : ${path.relative(ROOT, artifactPath)}`));
    }
  }

  return issues;
}

export async function collectArtifactEntries(filePaths, { exercisesRoot = EXERCISES_ROOT } = {}) {
  const entries = [];

  for (const sourceFilePath of filePaths) {
    const source = await fs.readFile(sourceFilePath, 'utf8');
    const imagePaths = extractIncludegraphicsPaths(source);
    if (imagePaths.length === 0) continue;

    const uuid = withoutComments(source).match(/\\uuid\s*\{([^}]*)\}/)?.[1]?.trim();
    if (!uuid) {
      entries.push({
        filePath: path.relative(ROOT, sourceFilePath),
        sourceFilePath,
        uuid: null,
        imagePath: null,
        invalidUuid: true
      });
      continue;
    }

    for (const imagePath of imagePaths) {
      entries.push({
        filePath: path.relative(ROOT, sourceFilePath),
        sourceFilePath,
        uuid,
        imagePath
      });
    }
  }

  return entries;
}

function printIssues(issues) {
  for (const current of issues) {
    if (current.invalidUuid) {
      console.error(`❌ ${current.filePath} — UUID absent`);
      continue;
    }
    console.error(`❌ ${current.filePath} [${current.uuid}] — ${current.message}`);
  }
}

async function main() {
  const requestedPaths = process.argv.slice(2).filter(argument => argument !== '--');
  const sourceFiles = requestedPaths.length === 0
    ? await listTexFiles(EXERCISES_ROOT)
    : requestedPaths.map(requestedPath => path.resolve(ROOT, requestedPath));

  const entries = await collectArtifactEntries(sourceFiles);
  const invalidUuid = entries.filter(entry => entry.invalidUuid);
  const issues = [...invalidUuid, ...await validateArtifactReferences(entries.filter(entry => !entry.invalidUuid))];

  if (issues.length > 0) {
    printIssues(issues);
    console.error(`\n❌ Artefacts incohérents : ${issues.length} problème(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Artefacts d'images cohérents (${entries.length} \\includegraphics vérifié(s)).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(`💥 ${error.message}`);
    process.exitCode = 1;
  });
}
