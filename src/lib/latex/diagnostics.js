/**
 * Diagnostics exploitables extraits d'un journal LaTeX.
 * Le journal brut reste la source de vérité : ce parseur ne cherche qu'à
 * fournir des raccourcis de navigation dans l'éditeur.
 */

/**
 * @typedef {{ severity: 'error'|'warning', line: number|null, message: string }} LatexDiagnostic
 */

/**
 * @param {string} log
 * @returns {LatexDiagnostic[]}
 */
export function parseLatexDiagnostics(log) {
  const lines = String(log || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const diagnostics = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const error = line.match(/^!\s*(.+?)\s*$/);
    if (error) {
      let sourceLine = null;
      for (
        let offset = 1;
        offset <= 8 && index + offset < lines.length;
        offset++
      ) {
        const location = lines[index + offset].match(/^l\.(\d+)\s*/);
        if (location) {
          sourceLine = Number(location[1]);
          break;
        }
      }
      diagnostics.push({
        severity: "error",
        line: sourceLine,
        message: error[1],
      });
      continue;
    }

    const warning = line.match(
      /^(?:LaTeX|Package\s+[^\s]+|Class\s+[^\s]+) Warning:\s*(.+?)(?:\s+on input line\s+(\d+)\.?)?\s*$/,
    );
    if (warning) {
      diagnostics.push({
        severity: "warning",
        line: warning[2] ? Number(warning[2]) : null,
        message: warning[1],
      });
    }
  }

  const seen = new Set();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.severity}:${diagnostic.line}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
