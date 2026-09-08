import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'public/**'],
  },
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        React: 'readonly',
        ReactDOM: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
  {
    // Leftovers of the pre-Django design prototype. None of these files is
    // imported by src/main.js, so nothing in them ships: they are galleries of
    // stand-alone cards and alternative tooth-chart layouts kept for reference.
    // Every warning they produce is an unused card/variant definition, which is
    // what the files are *for* — and 33 of them drowned out the warnings in live
    // code (#123). Removing the files is tracked in #115 / #116; until then the
    // rule is scoped out here rather than silenced with per-line comments.
    files: [
      'src/components/design-canvas.jsx',
      'src/components/molaris-app.jsx',
      'src/components/variant-anatomical.jsx',
      'src/components/variant-arch.jsx',
      'src/components/variant-grid.jsx',
    ],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
