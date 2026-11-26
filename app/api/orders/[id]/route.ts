import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized } from "@/lib/errors";
import { orderRepository } from "@/lib/repositories/orderRepository";
import { presentOrder } from "@/lib/presenters";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const { id } = await params;
    const order = await orderRepository.findById(id);
    if (!order) throw notFound("Order not found");
    if (user.role !== "ADMIN" && order.customerId !== user.id) {
      throw forbidden("This order belongs to another customer");
    }
    return NextResponse.json({ order: presentOrder(order) });
  } catch (err) {
    return errorResponse(err);
  }
}
