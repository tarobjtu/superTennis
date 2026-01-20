/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'apps/mobile/src/services/**/*.ts',
    'apps/mobile/src/stores/**/*.ts',
    '!apps/**/src/**/*.tsx',
    '!apps/**/src/**/*.d.ts',
    '!apps/**/src/**/api.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    // 核心 AI 服务需要高覆盖率
    'apps/mobile/src/services/hawkEye.ts': {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
    'apps/mobile/src/services/tennisAI.ts': {
      branches: 60,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/mobile/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
};
