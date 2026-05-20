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
];
