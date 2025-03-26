const nx = require('@nx/eslint-plugin');

function flattenConfig(config) {
  return Array.isArray(config) ? config.flat() : [config];
}

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
    ],
  },

  ...flattenConfig(nx.configs['flat/base']),
  ...flattenConfig(nx.configs['flat/typescript']),
  ...flattenConfig(nx.configs['flat/javascript']),

  {
    files: ['apps/core/**/*.{ts,tsx,js,jsx,cjs,mjs}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/core/**/*.{ts,tsx,js,jsx,cjs,mjs}'],
    rules: {},
  },
];
