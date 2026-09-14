// @ts-check
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
const webFiles = ['apps/web/**/*.{ts,tsx,js,mjs}'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/generated/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // `any` é sinal de tipo não entendido: erro, não aviso.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  // Regras do Next.js só para o dashboard; o plugin precisa saber onde fica a raiz do app.
  ...compat
    .extends('next/core-web-vitals', 'next/typescript')
    .map((config) => ({ ...config, files: webFiles })),
  {
    files: webFiles,
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: 'apps/web' } },
  },
  prettier,
);
