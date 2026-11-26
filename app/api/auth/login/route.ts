import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { errorResponse, parseBody } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { presentUser } from "@/lib/presenters";

export async function POST(req: Request) {
  try {
    const input = await parseBody(req, loginSchema);
    const user = await signIn(input.email, input.password);
    return NextResponse.json({ user: presentUser(user) });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid email or password") {
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: err.message, details: null } },
        { status: 401 },
      );
    }
    return errorResponse(err);
  }
}
