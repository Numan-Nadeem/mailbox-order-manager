import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized } from "@/lib/errors";
import { runWorkerOnce } from "@/lib/services/worker";

/**
 * Run one worker pass on demand (admin only). Handy for the demo and for
 * local development; production runs `npm run worker` instead.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    if (user.role !== "ADMIN") throw forbidden("Only admins can trigger the worker");
    const result = await runWorkerOnce(`manual-${user.id.slice(0, 8)}`);
    return NextResponse.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
