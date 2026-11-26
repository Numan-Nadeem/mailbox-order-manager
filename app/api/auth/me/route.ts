import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { presentUser } from "@/lib/presenters";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not signed in", details: null } },
        { status: 401 },
      );
    }
    return NextResponse.json({ user: presentUser(user) });
  } catch (err) {
    return errorResponse(err);
  }
}
