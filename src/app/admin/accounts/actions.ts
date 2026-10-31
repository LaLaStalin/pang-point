"use server";

import { requireAdmin, type Account } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../stock/actions";

export async function setPassword(account: Account, password: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_password", { p_account: account, p_password: password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
