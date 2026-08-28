import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['bin/**/*.js', 'src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-condition': 'off',
    },
  },
  {
    ignores: ['build/**', 'result/**', 'legacy/**'],
  },
];
