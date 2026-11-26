import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests hit the real test database (see
    // src/lib/__tests__/orderService.integration.test.ts). They run after
    // the unit tests in the same run.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL:
        "postgresql://mailbox_app:mailbox_dev@localhost:5432/mailbox_test",
    },
  },
});
