// build/utils/tikz2svg-utils.mjs
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';

const fsPromises = fs.promises;
const execPromise = util.promisify(exec);

export const defaultConfig = {
  preamble: `
    \\usetikzlibrary{arrows,shapes,backgrounds,patterns}
    \\usetikzlibrary{positioning}
    \\usetikzlibrary{calc}
    \\usetikzlibrary{arrows.meta}
    \\usetikzlibrary{patterns}
    \\usetikzlibrary{fit}
    \\usetikzlibrary{shapes.geometric}
    \\usetikzlibrary{decorations.pathmorphing}
    \\usetikzlibrary{decorations.markings}
  `,
  packages: `
    \\usepackage{pgfplots}
    \\usepackage{tikz-cd}
    \\usepackage{circuitikz}
    \\usepackage{amsmath}
    \\usepackage{amssymb}
    \\pgfplotsset{compat=1.18}
  `,
  svgOptions: {
    scale: 1,
    optimization: true,
    className: 'tikz-diagram'
  }
};

export async function checkDependencies() {
    // ... (fonction inchangée)
    try {
        await execPromise('pdflatex --version');
        try {
          await execPromise('pdf2svg --version 2>/dev/null || pdf2svg');
          return { success: true, converter: 'pdf2svg' };
        } catch {
          try {
            await execPromise('dvisvgm --version');
            return { success: true, converter: 'dvisvgm' };
          } catch {
            try {
              await execPromise('inkscape --version');
              return { success: true, converter: 'inkscape' };
            } catch {
              return { success: false, error: 'No SVG converter found. Install pdf2svg, dvisvgm, or inkscape.' };
            }
          }
        }
    } catch {
        return { success: false, error: 'pdflatex not found. Please install a TeX distribution (TeX Live, MiKTeX).' };
    }
}

/**
 * Crée un document LaTeX complet pour compilation
 * CORRIGÉ : N'ajoute l'environnement tikzpicture que s'il est manquant.
 */
function createTexDocument(tikzContent, config) {
  // Vérifier si le contenu est déjà un environnement complet.
  const tikzCode = tikzContent.trim().startsWith('\\begin{tikzpicture}')
    ? tikzContent
    : `\\begin{tikzpicture}\n${tikzContent}\n\\end{tikzpicture}`;

  return `\\documentclass[crop,tikz,border=2pt]{standalone}
${config.packages}
\\usepackage{tikz}
${config.preamble}
\\begin{document}
${tikzCode}
\\end{document}`;
}

// ... (le reste du fichier est identique, vous pouvez le laisser tel quel)

function optimizeSvg(svgContent, options) {
    if (!options.optimization) return svgContent;
  
    let optimized = svgContent
      .replace(/<\?xml.*?\?>\s*/s, '')
      .replace(/<!DOCTYPE.*?>\s*/s, '')
      .replace(/<!--.*?-->\s*/sg, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  
    if (options.className) {
      optimized = optimized.replace(
        /<svg([^>]*)>/,
        `<svg$1 class="${options.className}">`
      );
    }
  
    return optimized;
}

async function extractTeXError(logPath) {
    try {
      const logContent = await fsPromises.readFile(logPath, 'utf8');
      const errorMatch = logContent.match(/^!.*(?:\r\n|\n)/m);
      if (errorMatch) {
        return errorMatch[0];
      }
      const fatalError = logContent.match(/Fatal error occurred, no output PDF file produced!/);
      if(fatalError) {
          return `Fatal error during compilation. Check the log file: ${logPath}`;
      }
      return 'Unknown compilation error. Check log file.';
    } catch (error) {
      return `Cannot read log file: ${error.message}`;
    }
}

export async function convertTikzToSVG(tikzContent, config = defaultConfig) {
    let tmpDir = null;
    
    try {
      const deps = await checkDependencies();
      if (!deps.success) throw new Error(deps.error);
  
      tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'tikz-oym-'));
      const texFile = path.join(tmpDir, 'tikz-figure.tex');
      const texContent = createTexDocument(tikzContent, config);
  
      await fsPromises.writeFile(texFile, texContent, 'utf8');
  
      const pdflatexCommand = `pdflatex -interaction=nonstopmode -file-line-error -halt-on-error -output-directory="${tmpDir}" "${texFile}"`;
  
      try {
        await execPromise(pdflatexCommand);
      } catch (texError) {
        const logPath = path.join(tmpDir, 'tikz-figure.log');
        const errorDetails = await extractTeXError(logPath);
        throw new Error(`LaTeX compilation failed: ${errorDetails}`);
      }
  
      const pdfFile = path.join(tmpDir, 'tikz-figure.pdf');
      if (!fs.existsSync(pdfFile)) {
        const logPath = path.join(tmpDir, 'tikz-figure.log');
        const errorDetails = await extractTeXError(logPath);
        throw new Error(`PDF file not generated. Error: ${errorDetails}`);
      }
  
      const svgFile = path.join(tmpDir, 'tikz-figure.svg');
      
      try {
        switch (deps.converter) {
          case 'pdf2svg':
            await execPromise(`pdf2svg "${pdfFile}" "${svgFile}"`);
            break;
          case 'dvisvgm':
            await execPromise(`dvisvgm --pdf --no-fonts --optimize=all "${pdfFile}" -o "${svgFile}"`);
            break;
          case 'inkscape':
            await execPromise(`inkscape --pdf-poppler "${pdfFile}" --export-type=svg --export-filename="${svgFile}"`);
            break;
          default:
            throw new Error(`Unknown converter: ${deps.converter}`);
        }
      } catch (convError) {
        throw new Error(`SVG conversion with ${deps.converter} failed: ${convError.message}`);
      }
  
      if (!fs.existsSync(svgFile)) throw new Error('SVG file was not generated');
  
      const svgContent = await fsPromises.readFile(svgFile, 'utf8');
      return optimizeSvg(svgContent, config.svgOptions);
  
    } catch (error) {
      error.svg = createErrorSvg(error.message, tikzContent);
      throw error;
    } finally {
      if (tmpDir) {
        await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(e => console.warn(`Cleanup warning: ${e.message}`));
      }
    }
}

function createErrorSvg(errorMessage, tikzContent) {
    const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const truncatedError = escapeHtml(errorMessage.length > 200 ? errorMessage.substring(0, 200) + '...' : errorMessage);
    const truncatedContent = escapeHtml(tikzContent.length > 250 ? tikzContent.substring(0, 250) + '...' : tikzContent);
  
    return `<svg viewBox="0 0 500 200" class="tikz-error" style="border: 2px dashed #dc3545; background: #f8d7da; max-width: 100%; height: auto;">
      <g font-family="monospace" font-size="12" fill="#721c24">
        <text x="50%" y="25" text-anchor="middle" font-size="14" font-weight="bold">TikZ Conversion Error</text>
        <foreignObject x="10" y="40" width="480" height="60">
          <pre xmlns="http://www.w3.org/1999/xhtml" style="font-size: 10px; color: #721c24; white-space: pre-wrap; word-wrap: break-word;">Error: ${truncatedError}</pre>
        </foreignObject>
        <text x="10" y="110" font-size="10" fill="#6c757d">Content:</text>
        <foreignObject x="10" y="120" width="480" height="70">
          <pre xmlns="http://www.w3.org/1999/xhtml" style="font-size: 9px; color: #6c757d; white-space: pre-wrap; word-wrap: break-word;">${truncatedContent}</pre>
        </foreignObject>
      </g>
    </svg>`;
}