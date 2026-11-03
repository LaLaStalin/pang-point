"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/admin/stock/actions";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdjustReason } from "@/lib/types";

// ส่งคำขอให้แอดมินอนุมัติ — stock ยังไม่ลดจนกว่าจะอนุมัติ
export async function requestStockAdjustment(input: {
  product_id: number;
  qty: number;
  reason: AdjustReason;
  note: string;
}): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_stock_adjustment", {
    p_product_id: input.product_id,
    p_qty: input.qty,
    p_reason: input.reason,
    p_note: input.note,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
