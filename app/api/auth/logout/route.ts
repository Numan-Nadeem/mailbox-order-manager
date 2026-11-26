import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function POST() {
  try {
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
