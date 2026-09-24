import { defineConfig, devices } from '@playwright/test';

/**
 * Tests d'interface. Le script `test:integration` existait depuis longtemps
 * mais ne lançait rien : ni configuration, ni fichier de test. Les corrections
 * d'ergonomie de la page de recherche n'étaient donc protégées par rien.
 *
 * Les projets sont séparés par plateforme parce que le comportement l'est :
 * la prévisualisation est une colonne sur ordinateur et une feuille tactile sur
 * téléphone, et la destination d'ouverture d'un exercice en dépend.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  // La base SQLite est partagée et le serveur de dev est unique : on ne
  // parallélise pas, les gains seraient minces et les interférences réelles.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /.*\.desktop\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'mobile',
      testMatch: /.*\.mobile\.spec\.js/,
      // Pixel 5 : viewport 393×851, hasTouch, isMobile — donc les événements
      // tactiles passent par le vrai pipeline d'entrée du navigateur.
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 180_000
  }
});
