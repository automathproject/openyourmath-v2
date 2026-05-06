#!/usr/bin/env node
// scripts/ia/db-snapshot.js
// Crée, publie, télécharge et restaure un snapshot de data/exercises.sqlite.
// Le snapshot contient une copie SQLite cohérente produite par VACUUM INTO.

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "exercises.sqlite");
const SNAPSHOT_WORK_DIR = path.join(DATA_DIR, ".snapshot");
const SNAPSHOT_DB_RELATIVE = path.join("data", "exercises.sqlite");
const DEFAULT_ARCHIVE = path.join(DATA_DIR, "openyourmath-db-snapshot.tgz");
const DEFAULT_TAG = "db-snapshot-dev";

const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`
Usage:
  pnpm db:snapshot:pack [archive.tgz]
  pnpm db:snapshot:publish [tag] [archive.tgz]
  pnpm db:snapshot:download [tag] [archive.tgz]
  pnpm db:snapshot:restore [archive.tgz]

Defaults:
  tag         ${DEFAULT_TAG}
  archive     ${path.relative(PROJECT_ROOT, DEFAULT_ARCHIVE)}
`);
}

function fail(message, code = 1) {
  console.error(`❌ ${message}`);
  process.exit(code);
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    ...options,
  });

  if (result.error?.code === "ENOENT") {
    fail(`Commande introuvable: ${cmd}`);
  }

  if (result.status !== 0) {
    fail(`Commande échouée: ${cmd} ${cmdArgs.join(" ")}`, result.status ?? 1);
  }
}

function resolveArchive(value) {
  return path.resolve(PROJECT_ROOT, value || DEFAULT_ARCHIVE);
}

function ensureDbExists() {
  if (!fs.existsSync(DB_PATH)) {
    fail(
      `DB absente: ${path.relative(PROJECT_ROOT, DB_PATH)}. Lancez pnpm build:content puis pnpm index:exercises.`,
    );
  }
}

function createConsistentDbCopy(targetPath) {
  ensureDbExists();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.rmSync(targetPath, { force: true });

  const escapedTarget = targetPath.replace(/'/g, "''");
  const sqliteCli = spawnSync(
    "sqlite3",
    [DB_PATH, `VACUUM INTO '${escapedTarget}';`],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    },
  );

  if (sqliteCli.status === 0 && fs.existsSync(targetPath)) {
    return;
  }

  if (sqliteCli.error?.code !== "ENOENT") {
    console.log("ℹ️  Fallback better-sqlite3 pour créer le snapshot...");
  }

  const mod = require("better-sqlite3");
  const Database = mod.default || mod;
  const db = new Database(DB_PATH, { readonly: true });
  try {
    db.prepare("VACUUM INTO ?").run(targetPath);
  } finally {
    db.close();
  }
}

function pack(archivePath = DEFAULT_ARCHIVE) {
  const archive = resolveArchive(archivePath);
  const snapshotDb = path.join(SNAPSHOT_WORK_DIR, SNAPSHOT_DB_RELATIVE);

  fs.rmSync(SNAPSHOT_WORK_DIR, { recursive: true, force: true });
  createConsistentDbCopy(snapshotDb);
  fs.rmSync(archive, { force: true });
  fs.mkdirSync(path.dirname(archive), { recursive: true });

  run("tar", ["-czf", archive, "-C", SNAPSHOT_WORK_DIR, SNAPSHOT_DB_RELATIVE]);
  fs.rmSync(SNAPSHOT_WORK_DIR, { recursive: true, force: true });

  const sizeMb = fs.statSync(archive).size / 1024 / 1024;
  console.log(
    `✅ Snapshot créé: ${path.relative(PROJECT_ROOT, archive)} (${sizeMb.toFixed(1)} Mo)`,
  );
}

function publish(tag = DEFAULT_TAG, archivePath = DEFAULT_ARCHIVE) {
  const archive = resolveArchive(archivePath);
  if (!fs.existsSync(archive)) pack(archive);

  const notes = [
    "SQLite DB snapshot for dev machine transfer.",
    "Contains data/exercises.sqlite, including exercise_embeddings.",
  ].join("\n");

  const create = spawnSync(
    "gh",
    ["release", "create", tag, archive, "--title", tag, "--notes", notes],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    },
  );

  if (create.error?.code === "ENOENT") fail("Commande introuvable: gh");
  if (create.status === 0) {
    console.log(`✅ Release publiée: ${tag}`);
    return;
  }

  console.log(
    "ℹ️  La release existe peut-être déjà, remplacement de l’asset...",
  );
  run("gh", ["release", "upload", tag, archive, "--clobber"]);
  console.log(`✅ Asset publié: ${tag}`);
}

function download(tag = DEFAULT_TAG, archivePath = DEFAULT_ARCHIVE) {
  const archive = resolveArchive(archivePath);
  fs.rmSync(archive, { force: true });
  fs.mkdirSync(path.dirname(archive), { recursive: true });

  run("gh", [
    "release",
    "download",
    tag,
    "--pattern",
    path.basename(archive),
    "--dir",
    path.dirname(archive),
    "--clobber",
  ]);

  if (!fs.existsSync(archive)) {
    fail(
      `Archive téléchargée introuvable: ${path.relative(PROJECT_ROOT, archive)}`,
    );
  }
  console.log(
    `✅ Snapshot téléchargé: ${path.relative(PROJECT_ROOT, archive)}`,
  );
}

function restore(archivePath = DEFAULT_ARCHIVE) {
  const archive = resolveArchive(archivePath);
  if (!fs.existsSync(archive)) {
    fail(`Archive absente: ${path.relative(PROJECT_ROOT, archive)}`);
  }

  const restoreDir = path.join(DATA_DIR, ".restore");
  const restoredDb = path.join(restoreDir, SNAPSHOT_DB_RELATIVE);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.rmSync(restoreDir, { recursive: true, force: true });
  fs.mkdirSync(restoreDir, { recursive: true });
  run("tar", ["-xzf", archive, "-C", restoreDir, SNAPSHOT_DB_RELATIVE]);

  if (!fs.existsSync(restoredDb)) {
    fs.rmSync(restoreDir, { recursive: true, force: true });
    fail(
      `Restauration incomplète: ${SNAPSHOT_DB_RELATIVE} absent après extraction`,
    );
  }

  fs.rmSync(DB_PATH, { force: true });
  fs.rmSync(`${DB_PATH}-wal`, { force: true });
  fs.rmSync(`${DB_PATH}-shm`, { force: true });
  fs.copyFileSync(restoredDb, DB_PATH);
  fs.rmSync(restoreDir, { recursive: true, force: true });

  if (!fs.existsSync(DB_PATH)) {
    fail(
      `Restauration incomplète: ${path.relative(PROJECT_ROOT, DB_PATH)} absent après extraction`,
    );
  }
  console.log(`✅ DB restaurée: ${path.relative(PROJECT_ROOT, DB_PATH)}`);
  console.log(
    "   Lancez pnpm cache:embeddings:restore pour reconstruire cache/embeddings/.",
  );
}

switch (command) {
  case "pack":
    pack(args[0]);
    break;
  case "publish":
    publish(args[0] || DEFAULT_TAG, args[1]);
    break;
  case "download":
    download(args[0] || DEFAULT_TAG, args[1]);
    break;
  case "restore":
    restore(args[0]);
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    usage();
    break;
  default:
    usage();
    fail(`Commande inconnue: ${command}`);
}
