import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node', // Prisma e Supabase precisam de Node (setImmediate, etc). Testes React usam @jest-environment jsdom individualmente.
  testTimeout: 30000,

  setupFiles: ['<rootDir>/jest.setupEnv.ts'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  maxWorkers: 1, // Força execução sequencial (equivalente a --runInBand) para evitar condições de corrida no banco de dados compartilhado
  forceExit: true, // Garante que Jest não fique travado aguardando conexões de rede abertas (Prisma, Supabase)

  // Add more setup options before each test is run
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
