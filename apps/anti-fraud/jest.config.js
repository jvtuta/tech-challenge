/** @type {import('jest').Config} */
const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
};

/** Dois projetos na mesma config: `pnpm test`, o gate e a extensão da IDE enxergam os dois. */
module.exports = {
  // Os testes de ponta a ponta compartilham o banco e o broker: arquivos em paralelo se atropelam.
  maxWorkers: 1,
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
