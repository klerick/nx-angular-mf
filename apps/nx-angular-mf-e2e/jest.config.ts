
export default {
  displayName: 'nx-angular-mf-e2e',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/nx-angular-mf-e2e',
  globalSetup: './tools/start-servers.ts',
  globalTeardown: './tools/stop-servers.ts',
};
