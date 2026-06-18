import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// electron-log/main pulls in Electron internals that don't exist under Node,
// so stub it for unit tests of the pure main-process helpers.
const electronLogStub = path.resolve(dirname, "test/stubs/electron-log.ts");

export default defineConfig({
  resolve: {
    alias: {
      "electron-log/main": electronLogStub,
      "electron-log": electronLogStub,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["electron/srt.ts", "electron/json.ts", "electron/retry.ts", "electron/validation.ts", "electron/jobsLogic.ts", "electron/glossary.ts", "electron/version.ts", "shared/quota.ts", "shared/localizationLimits.ts"],
    },
  },
});
