import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      roots: ["<rootDir>/src"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.json",
          },
        ],
      },
      testMatch: [
        "**/api/**/__tests__/**/*.test.ts",
        "**/lib/**/__tests__/**/*.test.ts",
        "**/services/**/__tests__/**/*.test.ts",
        "**/src/__tests__/**/*.test.ts",
      ],
    },
    {
      displayName: "jsdom",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      roots: ["<rootDir>/src"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.jest.json",
          },
        ],
      },
      testMatch: [
        "**/app/**/__tests__/**/*.test.tsx",
        "**/components/**/__tests__/**/*.test.tsx",
      ],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default config;
