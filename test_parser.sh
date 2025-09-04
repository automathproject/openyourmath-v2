# Script de test pour le parser LaTeX OpenYourMath V2

echo "🧪 Test du parser LaTeX OpenYourMath V2"
echo "======================================="

# Copier les fichiers utils dans le projet
echo "📁 Création des fichiers utils..."

# 1. Créer le dossier utils
mkdir -p build/utils

# 2. Copier tex2html-utils.js (depuis l'artifact)
cat > build/utils/tex2html-utils.js << 'EOF'
// (Le contenu de l'artifact tex2html_utils sera copié ici)
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';

const execPromise = util.promisify(exec);

export function preprocessLatex(latex) {
  const replacements = {
    "\\'E": 'É', "\\'e": 'é', "\\'a": 'á', "\\'i": 'í', "\\'o": 'ó', "\\'u": 'ú',
    "\\'A": 'Á', "\\'I": 'Í', "\\'O": 'Ó', "\\'U": 'Ú',
    "\\`E": 'È', "\\`e": 'è', "\\`a": 'à', "\\`i": 'ì', "\\`o": 'ò', "\\`u": 'ù',
    "\\`A": 'À', "\\`I": 'Ì', "\\`O": 'Ò', "\\`U": 'Ù',
    "\\^E": 'Ê', "\\^e": 'ê', "\\^a": 'â', "\\^i": 'î', "\\^o": 'ô', "\\^u": 'û',
    "\\^A": 'Â', "\\^I": 'Î', "\\^O": 'Ô', "\\^U": 'Û',
    '\\"E': 'Ë', '\\"e': 'ë', '\\"a': 'ä', '\\"i': 'ï', '\\"o': 'ö', '\\"u': 'ü',
    '\\"A': 'Ä', '\\"I': 'Ï', '\\"O': 'Ö', '\\"U': 'Ü',
    "\\c{C}": 'Ç', "\\c{c}": 'ç',
    "\\~N": 'Ñ', "\\~n": 'ñ'
  };

  let processed = latex;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(pattern.replace(/[\\{}^$*+?.()|[\]]/g, '\\$&'), 'g');
    processed = processed.replace(regex, replacement);
  }
  
  return processed;
}

export function stripComments(str) {
  return str.replace(/(?<!\\)%.*$/gm, '').trim();
}

export function wrapAlignWithDollar(content) {
  return content
    .replace(/\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g, '$$$\\begin{align*}$1\\end{align*}$$$')
    .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '$$$\\begin{equation}$1\\end{equation}$$$')
    .replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, '$$$\\begin{gather}$1\\end{gather}$$$');
}

export function isCommandCommented(line, commandPosInLine) {
  for (let i = 0; i < commandPosInLine; i++) {
    if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
      return true;
    }
  }
  return false;
}

async function checkPandocAvailable() {
  try {
    await execPromise('pandoc --version');
    return true;
  } catch (error) {
    return false;
  }
}

export async function convertLaTeXToHTML(latex) {
  try {
    const pandocAvailable = await checkPandocAvailable();
    if (!pandocAvailable) {
      console.warn('Pandoc not available, using fallback conversion');
      return convertLaTeXToHTMLFallback(latex);
    }

    const latexPreprocessed = preprocessLatex(latex);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-convert-'));
    const tempInputPath = path.join(tempDir, 'temp_input.tex');
    const tempOutputPath = path.join(tempDir, 'temp_output.html');

    fs.writeFileSync(tempInputPath, latexPreprocessed, 'utf8');

    const pandocCommand = [
      'pandoc',
      `"${tempInputPath}"`,
      '-f latex+smart',
      '-t html5',
      '--mathml',
      '--wrap=preserve',
      '--standalone',
      '-o', `"${tempOutputPath}"`
    ].join(' ');

    await execPromise(pandocCommand);

    let html = fs.readFileSync(tempOutputPath, 'utf8');
    html = cleanPandocHTML(html);

    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);
    fs.rmdirSync(tempDir);

    return html;

  } catch (error) {
    console.error('Pandoc conversion error:', error.message);
    return convertLaTeXToHTMLFallback(latex);
  }
}

function cleanPandocHTML(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1];
  }

  html = html.replace(/<math[^>]*>([\s\S]*?)<\/math>/gi, (match, content) => {
    const cleaned = content
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return `$${cleaned}$`;
  });

  html = html
    .replace(/\s+id="[^"]*"/g, '')
    .replace(/\s+data-[^=]*="[^"]*"/g, '')
    .replace(/\s+>/g, '>')
    .trim();

  return html;
}

function convertLaTeXToHTMLFallback(latex) {
  console.warn('Using basic LaTeX→HTML fallback conversion');
  
  let html = latex;
  
  const basicConversions = {
    '\n\n': '</p><p>',
    '\\textbf{([^}]+)}': '<strong>$1</strong>',
    '\\textit{([^}]+)}': '<em>$1</em>',
    '\\emph{([^}]+)}': '<em>$1</em>',
    '\\begin{itemize}': '<ul>',
    '\\end{itemize}': '</ul>',
    '\\begin{enumerate}': '<ol>',
    '\\end{enumerate}': '</ol>',
    '\\item': '<li>',
    '\\\\': '<br>',
    '\\section{([^}]+)}': '<h2>$1</h2>',
    '\\subsection{([^}]+)}': '<h3>$1</h3>',
    '\\subsubsection{([^}]+)}': '<h4>$1</h4>'
  };

  for (const [pattern, replacement] of Object.entries(basicConversions)) {
    const regex = new RegExp(pattern, 'g');
    html = html.replace(regex, replacement);
  }

  if (!html.includes('<p>') && !html.includes('<ul>') && !html.includes('<ol>')) {
    html = `<p>${html}</p>`;
  }

  return html;
}
EOF

# 3. Créer tikz2svg-utils.js simplifié (sans TikZ pour le test)
cat > build/utils/tikz2svg-utils.js << 'EOF'
export async function checkDependencies() {
  return { 
    success: false, 
    error: 'TikZ support disabled for testing' 
  };
}

export async function extractAndConvertTikzBlocks(latex) {
  return []; // Pas de TikZ pour ce test
}
EOF

# 4. Créer cache-manager.js simplifié
cat > build/utils/cache-manager.js << 'EOF'
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const fsPromises = fs.promises;

export class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.metaFile = path.join(cacheDir, '.cache-meta.json');
  }

  async calculateFileHash(filePath) {
    try {
      const content = await fsPromises.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async isUpToDate(sourcePath, cachePath) {
    try {
      const cacheExists = await fsPromises.access(cachePath).then(() => true).catch(() => false);
      if (!cacheExists) return false;

      const sourceStats = await fsPromises.stat(sourcePath);
      const cacheStats = await fsPromises.stat(cachePath);
      
      return cacheStats.mtime >= sourceStats.mtime;
    } catch (error) {
      return false;
    }
  }

  async save(cachePath, data) {
    await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
    await fsPromises.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async updateMetadata(stats) {
    const metadata = {
      version: "1.0.0",
      last_update: new Date().toISOString(),
      total_exercises: stats.processed,
      build_stats: stats
    };
    
    await fsPromises.mkdir(this.cacheDir, { recursive: true });
    await fsPromises.writeFile(this.metaFile, JSON.stringify(metadata, null, 2), 'utf8');
  }
}
EOF

# 5. Créer hash-utils.js minimal
cat > build/utils/hash-utils.js << 'EOF'
export function validateHash(hash) {
  return typeof hash === 'string' && hash.length === 64;
}
EOF

echo "✅ Fichiers utils créés"

# Test du parser
echo ""
echo "🔍 Test du parsing du fichier d'exemple..."

# Vérifier que le fichier d'exemple existe
if [ ! -f "content/exercises/algebra/test.tex" ]; then
  echo "❌ Fichier d'exemple manquant: content/exercises/algebra/test.tex"
  exit 1
fi

echo "📄 Contenu du fichier d'exemple:"
echo "--------------------------------"
cat content/exercises/algebra/test.tex
echo ""
echo "--------------------------------"

# Exécuter le parser
echo "🚀 Exécution du parser..."
node build/parse-latex.js content/exercises/algebra/test.tex

# Vérifier le résultat
echo ""
echo "📊 Résultats:"
if [ -f "cache/exercises/algebra/test.json" ]; then
  echo "✅ Fichier JSON généré avec succès"
  echo ""
  echo "📋 Contenu généré:"
  echo "=================="
  cat cache/exercises/algebra/test.json | head -50
  echo ""
  echo "=================="
  echo ""
  echo "📏 Taille du fichier: $(wc -c < cache/exercises/algebra/test.json) octets"
  echo "📊 Structure:"
  echo "   - UUID: $(cat cache/exercises/algebra/test.json | grep -o '"uuid"[^,]*' | head -1)"
  echo "   - Titre: $(cat cache/exercises/algebra/test.json | grep -o '"title"[^,]*' | head -1)" 
  echo "   - Blocs de contenu: $(cat cache/exercises/algebra/test.json | grep -o '"type"' | wc -l)"
else
  echo "❌ Échec de la génération du fichier JSON"
  exit 1
fi

echo ""
echo "🎉 Test du parser terminé avec succès !"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Tester le build de la base SQLite: pnpm build:db"
echo "   2. Tester l'application web: pnpm dev"