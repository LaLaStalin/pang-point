import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * ร้านมี 2 บัญชี — Supabase Auth ต้องใช้อีเมลเป็นชื่อบัญชี จึงใช้อีเมลภายใน (ไม่มีการส่งอีเมลจริง)
 * สร้างบัญชีด้วย supabase/setup_accounts.sql
 */
export const ACCOUNT_EMAIL = {
  shop: "shop@pangpoint.local",
  admin: "admin@pangpoint.local",
} as const;

export type Account = keyof typeof ACCOUNT_EMAIL;

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, role")
    .eq("id", user.id)
    .single();
  return data;
});

export async function requireProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
