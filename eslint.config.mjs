import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/artifacts/**',
      '**/cache/**',
      '**/typechain-types/**',
      '**/deployed/**',
      '.omx/**',
      'shared/**',
    ],
  },
  {
    files: ['**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['backend/**/*.ts', 'smart-contract/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, ...globals.mocha },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
);
