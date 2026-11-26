import { z } from "zod";

// All input validation lives here. Route handlers only call parseBody() with
// one of these schemas; no validation logic lives in a handler or component.

const domainRegex =
  /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createOrderSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(domainRegex, "Enter a valid domain, for example acme.com"),
  provider: z.enum(["GOOGLE", "MICROSOFT"]),
  mailboxCount: z
    .number()
    .int("Mailbox count must be a whole number")
    .min(1, "At least 1 mailbox")
    .max(50, "At most 50 mailboxes per order"),
  // Clients send a UUID per form submission. Replaying the same key returns
  // the original order instead of creating a duplicate (idempotency).
  idempotencyKey: z.uuid("Idempotency key must be a UUID").optional(),
});

export const adminOrderListSchema = z.object({
  status: z.enum(["PENDING", "PROVISIONING", "ACTIVE", "FAILED"]).optional(),
  provider: z.enum(["GOOGLE", "MICROSOFT"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const retryOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AdminOrderListInput = z.infer<typeof adminOrderListSchema>;
