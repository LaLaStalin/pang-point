"use server";

import { redirect } from "next/navigation";
import { ACCOUNT_EMAIL, type Account } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function login(_prev: { error: string } | null, formData: FormData) {
  const account = String(formData.get("account") ?? "") as Account;
  const password = String(formData.get("password") ?? "");
  if (!(account in ACCOUNT_EMAIL)) return { error: "กรุณาเลือกบัญชี" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: ACCOUNT_EMAIL[account], password });
  if (error) return { error: "รหัสผ่านไม่ถูกต้อง" };

  redirect(account === "admin" ? "/admin" : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
