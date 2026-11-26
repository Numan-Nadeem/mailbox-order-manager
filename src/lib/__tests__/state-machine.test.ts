import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
} from "../../lib/state-machine";
import type { OrderStatus } from "@prisma/client";

const ALL: OrderStatus[] = ["PENDING", "PROVISIONING", "ACTIVE", "FAILED"];

describe("order state machine", () => {
  it("allows the happy path PENDING -> PROVISIONING -> ACTIVE", () => {
    expect(canTransition("PENDING", "PROVISIONING")).toBe(true);
    expect(canTransition("PROVISIONING", "ACTIVE")).toBe(true);
    expect(() => assertTransition("PENDING", "PROVISIONING")).not.toThrow();
    expect(() => assertTransition("PROVISIONING", "ACTIVE")).not.toThrow();
  });

  it("allows failure and admin retry: PENDING/PROVISIONING -> FAILED -> PENDING", () => {
    expect(canTransition("PENDING", "FAILED")).toBe(true);
    expect(canTransition("PROVISIONING", "FAILED")).toBe(true);
    expect(canTransition("FAILED", "PENDING")).toBe(true);
  });

  it("rejects every other transition", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const allowed = (ALLOWED_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
        if (from === to) continue; // self-transitions are rejected separately
        expect(canTransition(from, to)).toBe(allowed);
        if (!allowed) {
          expect(() => assertTransition(from, to)).toThrow(`Invalid transition: ${from} -> ${to}`);
        }
      }
    }
  });

  it("rejects self-transitions", () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
      expect(() => assertTransition(status, status)).toThrow("already");
    }
  });

  it("never leaves ACTIVE", () => {
    expect(ALLOWED_TRANSITIONS.ACTIVE).toEqual([]);
    for (const to of ALL) {
      expect(canTransition("ACTIVE", to)).toBe(false);
    }
  });
});
