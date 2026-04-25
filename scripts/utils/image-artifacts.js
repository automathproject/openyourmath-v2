import fs from 'fs';
import path from 'path';
import { getExerciseSourcePath, getSourceNameFromSourcePath } from './content-paths.js';

const fsPromises = fs.promises;

const SKIP_FORMATS = ['eps', 'ps', 'tex', 'tikz', 'maple', 'dvi'];
const PRIORITY_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'pdf'];
const SUPPORTED_FORMATS = ['pdf', 'png', 'svg', 'jpg', 'jpeg'];

function formatPath(baseDir, format) {
  return [path.join(baseDir, format), path.join(baseDir, format.toUpperCase())];
}

async function shouldCopyFile(sourcePath, destPath) {
  try {
    const [sourceStat, destStat] = await Promise.all([
      fsPromises.stat(sourcePath),
      fsPromises.stat(destPath).catch(() => null)
    ]);

    if (!destStat) return true;
    return sourceStat.mtime > destStat.mtime;
  } catch {
    return true;
  }
}

async function searchWithPriority(baseDir, baseName) {
  for (const tryExt of PRIORITY_EXTENSIONS) {
    for (const candidateDir of formatPath(baseDir, tryExt)) {
      if (!fs.existsSync(candidateDir)) continue;

      const exactPath = path.join(candidateDir, `${baseName}.${tryExt}`);
      if (fs.existsSync(exactPath)) {
        return { path: exactPath, ext: tryExt, folder: path.basename(candidateDir) };
      }

      try {
        const files = await fsPromises.readdir(candidateDir);
        const searchName = `${baseName}.${tryExt}`.toLowerCase();
        const match = files.find(file => file.toLowerCase() === searchName);
        if (match) {
          return { path: path.join(candidateDir, match), ext: tryExt, folder: path.basename(candidateDir) };
        }
      } catch {
        // ignore read errors and continue
      }
    }
  }

  return null;
}

function buildImagePathInfo(imagePath) {
  const normalized = imagePath.replace(/\\\\/g, '/');
  const segments = normalized.split('/');

  const lastSegment = segments[segments.length - 1];
  const dotIndex = lastSegment.lastIndexOf('.');
  const extension = dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : '';
  const baseFilename = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;

  return {
    hasFolder: segments.length > 1,
    rawFormat: extension,
    baseFilename,
    segments
  };
}

export async function resolveImagePath({ imagePath, sourceFilePath, contentRoot, logger = console }) {
  const exercisesDir = path.join(contentRoot, 'exercises');
  const sourcePath = getExerciseSourcePath(sourceFilePath, exercisesDir);
  const sourceName = getSourceNameFromSourcePath(sourcePath);

  if (!sourceName) {
    if (logger?.warn) logger.warn(`⚠️  Cannot resolve source root for image: ${imagePath}`);
    return null;
  }

  const { rawFormat, baseFilename, segments } = buildImagePathInfo(imagePath);

  if (rawFormat && SKIP_FORMATS.includes(rawFormat)) {
    if (logger?.info) {
      logger.info(`  ⏭️  Skipping ${rawFormat.toUpperCase()} source: ${imagePath}`);
    }
    return null;
  }

  let formatPart = rawFormat;
  let filenamePart = imagePath;

  if (segments.length > 1) {
    const imagesIndex = segments.indexOf('images');
    if (imagesIndex !== -1 && segments.length > imagesIndex + 2) {
      formatPart = segments[imagesIndex + 1];
      filenamePart = segments.slice(imagesIndex + 2).join('/');
    } else {
      formatPart = segments[0];
      filenamePart = segments.slice(1).join('/');
    }
  }

  if (!filenamePart) {
    return null;
  }

  const baseDir = path.join(contentRoot, 'images', sourceName);
  const prioritized = await searchWithPriority(baseDir, baseFilename);
  if (prioritized) {
    if (logger?.info) {
      logger.info(`  ℹ️  Found (priority ${prioritized.ext}): images/${sourceName}/${prioritized.folder}/${path.basename(prioritized.path)}`);
    }
    return prioritized.path;
  }

  if (formatPart && rawFormat) {
    const exactPath = path.join(contentRoot, 'images', sourceName, formatPart, filenamePart);
    if (fs.existsSync(exactPath)) {
      if (logger?.info) {
        logger.info(`  ℹ️  Found (exact match): images/${sourceName}/${formatPart}/${filenamePart}`);
      }
      return exactPath;
    }
  }

  if (logger?.warn) {
    logger.warn(`⚠️  Image not found: ${imagePath}`);
    logger.warn(`    Base name: ${baseFilename}`);
    logger.warn(`    Searched in: images/${sourceName}/{svg,png,jpg,jpeg,pdf}/`);
  }

  return null;
}

export async function extractIncludegraphicsImages({
  latexContent,
  exerciseUuid,
  sourceFilePath,
  contentRoot,
  artifactsRoot,
  publicBasePath,
  logger = console
}) {
  const regex = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/g;
  const replacements = new Map();
  const images = [];

  const outputDir = path.join(artifactsRoot, 'images', exerciseUuid);
  await fsPromises.mkdir(outputDir, { recursive: true });

  if (logger?.info) {
    logger.info('\n🔍 Searching for images...');
  }

  let match;
  let index = 1;

  while ((match = regex.exec(latexContent)) !== null) {
    const options = match[1] || '';
    const rawPath = match[2].trim();

    const resolvedPath = await resolveImagePath({
      imagePath: rawPath,
      sourceFilePath,
      contentRoot,
      logger
    });

    if (!resolvedPath) {
      continue;
    }

    const ext = path.extname(resolvedPath).slice(1).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      if (logger?.warn) {
        logger.warn(`⚠️  Unsupported format for artifacts: ${ext}`);
      }
      continue;
    }

    const imgId = `img_${index}`;
    const destFilename = `${imgId}.${ext}`;
    const destPath = path.join(outputDir, destFilename);
    const publicUrl = `${publicBasePath}/${exerciseUuid}/${destFilename}`;

    const copyNeeded = await shouldCopyFile(resolvedPath, destPath);
    if (copyNeeded) {
      await fsPromises.copyFile(resolvedPath, destPath);
      if (logger?.info) {
        logger.info(`  📸 Copied: ${path.relative(contentRoot, resolvedPath)} → ${destFilename}`);
      }
    }

    const relativeSource = path.relative(contentRoot, resolvedPath);

    images.push({
      id: imgId,
      url: publicUrl,
      originalPath: rawPath,
      sourcePath: relativeSource,
      sourceFilename: path.basename(resolvedPath),
      format: ext,
      ...(options && { options })
    });

    const imgTag = `<img src="${publicUrl}" alt="Image ${index}" class="includegraphics-image">`;
    replacements.set(match[0], imgTag);
    index++;
  }

  if (logger?.info) {
    if (images.length > 0) {
      logger.info(`  ✅ Found ${images.length} image(s)`);
    } else {
      logger.info('  ℹ️  No images to process');
    }
  }

  return { images, replacements };
}
