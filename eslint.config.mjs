import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // =====================================================
      // CONSOLE RULES
      // =====================================================
      // Warn for console.log, allow warn/error for production logging
      "no-console": ["warn", { 
        allow: ["warn", "error"] 
      }],
      
      // =====================================================
      // CODE QUALITY
      // =====================================================
      "prefer-const": "warn",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-duplicate-imports": "error",
      
      // =====================================================
      // TYPESCRIPT RULES
      // =====================================================
      // Turn off base rule in favor of TypeScript-aware version
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      
      // IMPORTANT: Prevent `any` type usage for type safety
      // Use `unknown` instead and narrow with type guards
      "@typescript-eslint/no-explicit-any": "warn",
      
      // Ensure async functions are properly awaited
      // Note: Requires type-aware linting (parserOptions.project)
      // "@typescript-eslint/no-floating-promises": "error",
      
      // Prevent duplicate class members
      "no-dupe-class-members": "off",
      "@typescript-eslint/no-dupe-class-members": "error",
      
      // Require explicit return types on exported functions
      // This helps with API contracts and documentation
      // "@typescript-eslint/explicit-function-return-type": ["warn", {
      //   allowExpressions: true,
      //   allowTypedFunctionExpressions: true,
      // }],
      
      // =====================================================
      // BEST PRACTICES
      // =====================================================
      // Enforce curly braces for all control statements
      "curly": ["warn", "multi-line"],
      
      // No assignment in conditional expressions
      "no-cond-assign": ["error", "except-parens"],
      
      // Disallow returning values from setters
      "no-setter-return": "error",
      
      // Warn about unreachable code
      "no-unreachable": "warn",
      
      // Disallow unused expressions
      "no-unused-expressions": ["warn", {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      }],
    }
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.config.{js,mjs,ts}",
    ]
  }
];
