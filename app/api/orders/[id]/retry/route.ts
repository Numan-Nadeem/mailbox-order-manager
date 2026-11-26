import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, forbidden, parseBody, unauthorized } from "@/lib/errors";
import { retryOrderSchema } from "@/lib/validation";
import { retryOrder } from "@/lib/services/orderService";
import { presentOrder } from "@/lib/presenters";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    if (user.role !== "ADMIN") throw forbidden("Only admins can retry orders");
    const { id } = await params;
    const input = await parseBody(req, retryOrderSchema);
    const order = await retryOrder(id, user.id, input.reason);
    return NextResponse.json({ order: presentOrder(order) });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid transition")) {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: err.message, details: null } },
        { status: 409 },
      );
    }
    return errorResponse(err);
  }
}
