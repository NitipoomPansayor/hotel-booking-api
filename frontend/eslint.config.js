import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  { files: ['**/*.{js,jsx}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }] } },
  { files: ['src/**/*.{js,jsx}'], plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: { ...hooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
];
