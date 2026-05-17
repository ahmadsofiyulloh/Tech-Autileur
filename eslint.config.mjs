import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          disallowTypeAnnotations: false,
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "react-hooks/error-boundaries": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
