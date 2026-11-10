const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'frontend/**', '.tmp/**', '.npm-cache/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
