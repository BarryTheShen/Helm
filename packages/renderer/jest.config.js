/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@keel/protocol$': '<rootDir>/../protocol/src',
    '^react-native-paper$': '<rootDir>/src/__tests__/__mocks__/react-native-paper.ts',
    '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.ts',
  },
};
