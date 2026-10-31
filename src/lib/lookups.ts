import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** map id -> ชื่อ สำหรับแสดงในตารางประวัติ */
export async function getNameMaps(supabase: SupabaseClient) {
  const [{ data: products }, { data: profiles }] = await Promise.all([
    supabase.from("products").select("id, name"),
    supabase.from("profiles").select("id, display_name"),
  ]);
  return {
    productName: new Map((products ?? []).map((p) => [p.id as number, p.name as string])),
    userName: new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string])),
  };
}
