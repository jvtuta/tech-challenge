/** @type {import('jest').Config} */
const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
};

/** Dois projetos na mesma config: `pnpm test`, o gate e a extensão da IDE enxergam os dois. */
module.exports = {
  projects: [
    { ...shared, displayName: 'unit', rootDir: 'src', testRegex: '.*\\.spec\\.ts$' },
    {
      ...shared,
      displayName: 'e2e',
      rootDir: 'test',
      testRegex: '.e2e-spec.ts$',
      setupFiles: ['<rootDir>/setup-env.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup-timeout.ts'],
    },
  ],
};
