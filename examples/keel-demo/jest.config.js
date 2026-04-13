/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@keel/protocol$': '<rootDir>/../../packages/protocol/src',
    '^@keel/renderer/presets/paper$': '<rootDir>/../../packages/renderer/src/presets/paper',
    '^@keel/renderer$': '<rootDir>/../../packages/renderer/src',
    '^react-native-paper$': '<rootDir>/../../packages/renderer/src/__tests__/__mocks__/react-native-paper.ts',
    '^react-native$': '<rootDir>/../../packages/renderer/src/__tests__/__mocks__/react-native.ts',
  },
};
