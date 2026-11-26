import type { Provider } from "@prisma/client";

/**
 * Strategy pattern: provisioning is one interface, one implementation per
 * mailbox provider. Adding a provider means adding one class and one line
 * in `getProvider` — no service or worker code changes.
 *
 * The mocks sleep a few seconds per call and fail about 20% of the time, as
 * the spec requires. `PROVIDER_FAIL_ALL=1` forces every call to fail, which
 * the demo uses to show the failure path deterministically.
 */

export interface MailboxProvider {
  readonly provider: Provider;
  /** Provision one mailbox address. Throws on failure. */
  provision(address: string): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFail(): boolean {
  if (process.env.PROVIDER_FAIL_ALL === "1") return true;
  return Math.random() < 0.2;
}

abstract class MockProvider implements MailboxProvider {
  abstract readonly provider: Provider;

  async provision(address: string): Promise<void> {
    // Real provider APIs take a few seconds per mailbox; the mock does too.
    await sleep(1000 + Math.random() * 2000);
    if (shouldFail()) {
      throw new Error(`Mock ${this.provider.toLowerCase()} API rejected ${address}`);
    }
  }
}

export class GoogleMailboxProvider extends MockProvider {
  readonly provider: Provider = "GOOGLE";
}

export class MicrosoftMailboxProvider extends MockProvider {
  readonly provider: Provider = "MICROSOFT";
}

export function getProvider(provider: Provider): MailboxProvider {
  switch (provider) {
    case "GOOGLE":
      return new GoogleMailboxProvider();
    case "MICROSOFT":
      return new MicrosoftMailboxProvider();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`No mailbox provider for ${_exhaustive}`);
    }
  }
}
