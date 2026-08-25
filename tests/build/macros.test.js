// Garde-fou du registre de macros (src/lib/macros.js).
//
// Le registre alimente deux chemins de rendu qui échouent différemment :
// KaTeX lève une erreur de parsing visible à l'écran, tandis que pandoc
// supprime silencieusement une commande inconnue. Une macro mal définie a donc
// pu rester des mois en production sans être remarquée (\im, \vide, \dlim
// levaient une erreur KaTeX ; \va et \vas disparaissaient du HTML).
//
// Ces tests vérifient qu'aucune entrée ne peut réintroduire ce défaut.

import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  MACRO_REGISTRY,
  macros,
  latexMacroDefinitions,
} from '../../src/lib/macros.js';

/** Arité réellement employée par le corps d'une macro (#1, #2, …). */
function bodyArity(value) {
  const used = [...value.matchAll(/#(\d)/g)].map((m) => Number(m[1]));
  return used.length > 0 ? Math.max(...used) : 0;
}

/** Appel minimal d'une macro, avec autant d'arguments que son arité. */
function sampleCall(entry) {
  return `\\${entry.name}` + (entry.args ? '{x}'.repeat(entry.args) : ' ');
}

describe('registre de macros', () => {
  it('ne déclare pas deux fois le même nom', () => {
    const names = MACRO_REGISTRY.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('déclare une arité cohérente avec le corps de chaque macro', () => {
    const mismatched = MACRO_REGISTRY.filter(
      (m) => bodyArity(m.value) !== (m.args || 0),
    ).map((m) => `\\${m.name} (déclarée ${m.args || 0}, corps ${bodyArity(m.value)})`);
    expect(mismatched).toEqual([]);
  });

  it('équilibre les accolades de chaque corps de macro', () => {
    // Le défaut d'origine : une accolade fermante orpheline en fin de valeur,
    // qui refermait le groupe englobant et cassait tout ce qui suivait.
    const unbalanced = MACRO_REGISTRY.filter((m) => {
      let depth = 0;
      for (let i = 0; i < m.value.length; i++) {
        if (m.value[i] === '\\') { i++; continue; }
        if (m.value[i] === '{') depth++;
        if (m.value[i] === '}') depth--;
        if (depth < 0) return true;
      }
      return depth !== 0;
    }).map((m) => `\\${m.name} → ${m.value}`);
    expect(unbalanced).toEqual([]);
  });

  it('rend sans erreur toutes les macros de mode math dans KaTeX', () => {
    const failures = [];
    for (const entry of MACRO_REGISTRY.filter((m) => m.mode !== 'text')) {
      try {
        katex.renderToString(`a = ${sampleCall(entry)} b`, {
          macros: { ...macros },
          throwOnError: true,
        });
      } catch (error) {
        failures.push(`\\${entry.name} → ${error.message.slice(0, 80)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("n'expose à KaTeX que les macros de mode math", () => {
    const textNames = MACRO_REGISTRY.filter((m) => m.mode === 'text').map(
      (m) => `\\${m.name}`,
    );
    for (const name of textNames) expect(macros).not.toHaveProperty(name);
    expect(Object.keys(macros)).toHaveLength(
      MACRO_REGISTRY.length - textNames.length,
    );
  });

  it('produit une définition LaTeX pour chaque entrée du registre', () => {
    expect(latexMacroDefinitions).toHaveLength(MACRO_REGISTRY.length);
    for (const { def } of latexMacroDefinitions) {
      expect(def).toMatch(/^\\(?:re)?newcommand\{\\[a-zA-Z0-9]+\}(?:\[\d\])?\{/);
    }
  });

  it('redéfinit les commandes déjà présentes dans LaTeX standard', () => {
    // \AA existe (l'ångström) : un \newcommand échouerait à la compilation.
    const aa = latexMacroDefinitions.find((d) => d.name === 'AA');
    expect(aa.def).toMatch(/^\\renewcommand/);
  });
});
