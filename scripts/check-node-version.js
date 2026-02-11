const REQUIRED_MAJOR = 22;
const current = process.versions.node;
const currentMajor = Number(current.split('.')[0]);

if (currentMajor !== REQUIRED_MAJOR) {
  console.error('');
  console.error('❌ Node.js version mismatch');
  console.error(`   Required: Node ${REQUIRED_MAJOR}.x`);
  console.error(`   Current : Node ${current}`);
  console.error('');
  console.error('Use a Node 22 runtime, then reinstall dependencies:');
  console.error('  nvm use 22  # or fnm use 22');
  console.error('  pnpm install');
  process.exit(1);
}
