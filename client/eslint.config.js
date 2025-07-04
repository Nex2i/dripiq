//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import { resolve } from 'node:path'

export default [
  ...tanstackConfig,
  {
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        alias: {
          map: [['@', resolve(process.cwd(), './src')]],
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
    },
  },
  {
    files: ['*.js', '*.cjs', '*.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-for-in-array': 'off',
      '@typescript-eslint/no-unnecessary-qualifier': 'off',
      '@typescript-eslint/no-unnecessary-type-arguments': 'off',
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/require-array-sort-compare': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
      '@typescript-eslint/prefer-return-this-type': 'off',
      '@typescript-eslint/dot-notation': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
  {
    rules: {
      'import/order': 'off',
      'import-x/order': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@stylistic/js/spaced-comment': 'off',
      'no-useless-catch': 'off',
      'no-shadow': 'off',
      'sort-imports': 'off',
    },
  },
]
