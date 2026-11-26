import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized } from "@/lib/errors";
import { adminOrderListSchema } from "@/lib/validation";
import { orderRepository } from "@/lib/repositories/orderRepository";
import { presentOrderSummary } from "@/lib/presenters";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    if (user.role !== "ADMIN") throw forbidden("Only admins can list all orders");
    const url = new URL(req.url);
    const parsed = adminOrderListSchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.issues } },
        { status: 422 },
      );
    }
    const { orders, total } = await orderRepository.listForAdmin(parsed.data);
    return NextResponse.json({
      orders: orders.map(presentOrderSummary),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      pageCount: Math.ceil(total / parsed.data.pageSize),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
