// Télécharge les PDF officiels des programmes CPGE listés dans
// content/referentiels/cpge/sources.json vers content/referentiels/cpge/sources/
// (répertoire ignoré par Git : seuls les liens sont versionnés).
// Usage : node scripts/fetch-programmes-cpge.js [--force]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'content/referentiels/cpge';
const DEST = path.join(ROOT, 'sources');
const force = process.argv.includes('--force');

const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
fs.mkdirSync(DEST, { recursive: true });

let failures = 0;
for (const { fichier, url } of sources) {
  const target = path.join(DEST, fichier);
  if (!force && fs.existsSync(target)) {
    console.log(`= ${fichier} (déjà présent)`);
    continue;
  }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error('réponse non PDF');
    fs.writeFileSync(target, buf);
    console.log(`+ ${fichier} (${Math.round(buf.length / 1024)} Kio)`);
  } catch (e) {
    failures++;
    console.error(`✗ ${fichier} : ${e.message} — ${url}`);
  }
}
process.exit(failures ? 1 : 0);
