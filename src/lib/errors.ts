import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * One error shape for every API route, so clients never have to guess.
 * { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {...} } }
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Not signed in"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You do not have access to this"): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string): ApiError {
  return new ApiError(409, "CONFLICT", message);
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.status },
    );
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Input failed validation",
          details: z.treeifyError(err),
        },
      },
      { status: 422 },
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: null } },
    { status: 500 },
  );
}

/** Parse a JSON body with a zod schema, or throw a 422 ApiError. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError(422, "VALIDATION_ERROR", "Input failed validation", z.treeifyError(result.error));
  }
  return result.data;
}
