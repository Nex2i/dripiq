const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');
const prettier = require('eslint-plugin-prettier');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      '**/*.css',
      '**/*.scss',
      'node_modules/**',
      'dist/**',
      'jest.config.js',
      'jest.setup.js',
      'src/bootstrap.ts', // Has special import ordering requirements
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser,
      globals: {
        __dirname: true,
        process: true,
        console: true,
        require: true,
        module: true,
        setInterval: true,
        setTimeout: true,
        clearInterval: true,
        clearTimeout: true,
        setImmediate: true,
        clearImmediate: true,
        fetch: true,
        Blob: true,
        AbortSignal: true,
        Response: true,
        Headers: true,
        Request: true,
        URL: true,
        URLSearchParams: true,
        Buffer: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
        node: {},
      },
    },
    rules: {
      // formatting
      'prettier/prettier': ['warn', { singleQuote: true, tabWidth: 2 }, { usePrettierrc: true }],
      'linebreak-style': ['error', 'unix'],

      // import hygiene
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/order': [
        'warn',
        { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'] },
      ],
      'import/export': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',

      // forbid dynamic/lazy imports in src
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='Import']",
          message: 'Dynamic import() is not allowed. Use static top-level imports.',
        },
      ],
      'global-require': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      'import/no-dynamic-require': 'error',

      // unused
      'unused-imports/no-unused-imports': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // misc TS
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['parameter', 'variable'],
          leadingUnderscore: 'forbid',
          filter: { regex: '_*', match: false },
          format: null,
        },
        {
          selector: 'parameter',
          leadingUnderscore: 'require',
          format: null,
          modifiers: ['unused'],
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'no-empty-pattern': 'off',
    },
  },

  // Jest test files configuration
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'readonly',
        Response: 'readonly',
        AbortSignal: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      // import rules don't matter in tests
      'import/first': 'off',
      'import/newline-after-import': 'off',
      'import/order': 'off',
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-dynamic-require': 'off',

      // allow any style of importing in tests
      'no-restricted-syntax': 'off', // permits import()
      'global-require': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      // optional: ignore unused imports in tests
      'unused-imports/no-unused-imports': 'off',
    },
  },
];
