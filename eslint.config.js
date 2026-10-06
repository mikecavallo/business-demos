import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'sites/', '_site/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
];
