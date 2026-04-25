import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
export const EXERCISES_ROOT = path.join(CONTENT_ROOT, 'exercises');
export const IMAGES_ROOT = path.join(CONTENT_ROOT, 'images');
export const METADATA_ROOT = path.join(CONTENT_ROOT, 'metadata');
export const CACHE_ROOT = path.join(PROJECT_ROOT, 'cache/exercises');
export const ARTIFACTS_ROOT = path.join(PROJECT_ROOT, 'static/artifacts');

export function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

export function normalizeContentRelativePath(value) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function getExerciseSourcePath(filePath, exercisesRoot = EXERCISES_ROOT) {
  return normalizeContentRelativePath(toPosixPath(path.relative(exercisesRoot, filePath)));
}

export function getSourceNameFromSourcePath(sourcePath) {
  const normalized = normalizeContentRelativePath(sourcePath || '');
  return normalized.split('/').filter(Boolean)[0] || null;
}

export function getMetadataPath(uuid, sourcePath = '') {
  const safeUuid = `${uuid}.json`;
  const normalized = normalizeContentRelativePath(sourcePath || '');
  const sourceDir = path.posix.dirname(normalized);

  if (!normalized || sourceDir === '.') {
    return path.join(METADATA_ROOT, safeUuid);
  }

  return path.join(METADATA_ROOT, ...sourceDir.split('/'), safeUuid);
}
