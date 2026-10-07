import js from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.angular/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', fetch: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  },
  {
    rules: {
      // `any` is forbidden unless a disable comment carries a justification.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  // Angular app: TypeScript (including inline templates) and template accessibility rules.
  {
    files: ['apps/web/**/*.ts'],
    processor: angular.processInlineTemplates,
    extends: [...angular.configs.tsRecommended],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    },
  },
  {
    files: ['apps/web/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
    },
  },
);
