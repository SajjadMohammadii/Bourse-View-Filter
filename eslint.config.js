import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

// Layering (PLAN.md §3.1): ui → app → core ← config; workers run app/core.
const layers = [
  { type: 'core', pattern: 'src/core/**' },
  { type: 'config', pattern: 'src/config/**' },
  { type: 'app', pattern: 'src/app/**' },
  { type: 'workers', pattern: 'src/workers/**' },
  { type: 'ui', pattern: 'src/ui/**' },
  { type: 'i18n', pattern: 'src/i18n/**' },
];

const allow = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: to } } } },
});

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': layers,
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          policies: [
            allow('core', ['core']),
            allow('config', ['config', 'core']),
            allow('app', ['app', 'core', 'config', 'workers']),
            allow('workers', ['workers', 'app', 'core', 'config']),
            allow('ui', ['ui', 'app', 'core', 'config', 'i18n']),
            allow('i18n', ['i18n']),
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      // core must stay pure: no DOM / storage globals.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'navigator',
        'location',
      ],
    },
  },
  {
    // Node tooling scripts (audits); not part of the app bundle.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-new-func': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
);
