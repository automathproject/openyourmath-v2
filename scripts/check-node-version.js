import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_REQUIRED_MAJOR = 22;

function getRequiredMajorFromNvmrc() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.nvmrc'), 'utf8').trim();
    const normalized = raw.startsWith('v') ? raw.slice(1) : raw;
    const major = Number(normalized.split('.')[0]);
    return Number.isInteger(major) ? major : DEFAULT_REQUIRED_MAJOR;
  } catch {
    return DEFAULT_REQUIRED_MAJOR;
  }
}

const REQUIRED_MAJOR = getRequiredMajorFromNvmrc();
const current = process.versions.node;
const currentMajor = Number(current.split('.')[0]);

if (currentMajor !== REQUIRED_MAJOR) {
  console.error('');
  console.error('❌ Node.js version mismatch');
  console.error(`   Required: Node ${REQUIRED_MAJOR}.x`);
  console.error(`   Current : Node ${current}`);
  console.error('');
  console.error(`Use a Node ${REQUIRED_MAJOR} runtime, then reinstall dependencies:`);
  console.error(`  nvm use ${REQUIRED_MAJOR}  # or fnm use ${REQUIRED_MAJOR}`);
  console.error('  pnpm install');
  process.exit(1);
}
