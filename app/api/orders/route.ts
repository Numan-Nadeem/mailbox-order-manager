import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, parseBody, unauthorized } from "@/lib/errors";
import { createOrderSchema } from "@/lib/validation";
import { createOrder } from "@/lib/services/orderService";
import { orderRepository } from "@/lib/repositories/orderRepository";
import { presentOrder, presentOrderSummary } from "@/lib/presenters";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const orders = await orderRepository.findByCustomer(user.id);
    return NextResponse.json({ orders: orders.map(presentOrderSummary) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const input = await parseBody(req, createOrderSchema);
    const { order, deduped } = await createOrder(user.id, input);
    return NextResponse.json({ order: presentOrder(order), deduped }, { status: deduped ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
