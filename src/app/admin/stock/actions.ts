"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdjustReason } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addStock(
  lines: { product_id: number; unit_cost: number; qty: number }[],
  supplier: string,
  note: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_stock", { p_lines: lines, p_supplier: supplier, p_note: note });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function reviewAdjustRequest(requestId: number, approve: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    approve ? "approve_stock_adjustment_request" : "reject_stock_adjustment_request",
    { p_request_id: requestId },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function updateAdjustmentReason(adjustmentId: number, reason: AdjustReason): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_adjustment_reason", {
    p_adjustment_id: adjustmentId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function adjustStockBatch(
  lines: { product_id: number; qty: number; reason: AdjustReason }[],
  note: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock_batch", { p_lines: lines, p_note: note });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
