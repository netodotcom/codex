import { defineConfig } from "vitest/config";

export default defineConfig({
  // Classic JSX so migrated components work identically in tests (real react)
  // and in the build (CDN react via the shim): both need React in scope.
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  test: {
    include: ["packages/**/src/**/*.test.{ts,tsx}"],
    // Default node; component tests opt into jsdom via `// @vitest-environment jsdom`.
    environment: "node",
    // globals:true makes afterEach available so @testing-library/react auto-cleans
    // mounted components between tests (otherwise renders accumulate in jsdom).
    globals: true,
  },
});
