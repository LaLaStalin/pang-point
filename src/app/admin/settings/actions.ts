"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QR_IMAGE_BUCKET, type QrMethod } from "@/lib/types";
import type { ActionResult } from "../stock/actions";

function done(error: { message: string; code?: string } | null, duplicate = "มีราคานี้อยู่แล้ว"): ActionResult {
  if (error) {
    if (error.code === "23505") return { ok: false, error: duplicate };
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const otherName = (price: number) => `อื่นๆ ${price} บาท`;

export async function saveQrSettings(input: {
  method: QrMethod;
  promptpayId: string;
  imagePath: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const id = input.promptpayId.replace(/[^0-9]/g, "");
  if (id && ![10, 13, 15].includes(id.length)) {
    return { ok: false, error: "เลขพร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร/ภาษี 13 หลัก" };
  }
  if (input.method === "image" && !input.imagePath) {
    return { ok: false, error: "เลือกรูป QR ก่อนบันทึก" };
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from("settings").select("qr_image_path").single();
  const { error } = await supabase
    .from("settings")
    .update({
      qr_method: input.method,
      promptpay_id: id || null,
      qr_image_path: input.imagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  // ลบรูปเก่าที่ถูกแทนที่ ถ้าลบไม่สำเร็จก็ไม่กระทบการใช้งาน
  if (!error && current?.qr_image_path && current.qr_image_path !== input.imagePath) {
    await supabase.storage.from(QR_IMAGE_BUCKET).remove([current.qr_image_path]);
  }
  return done(error);
}

export async function saveTierProduct(input: {
  id: number;
  name: string;
  retail_price: number;
  wholesale_price: number;
  low_stock_threshold: number;
}): Promise<ActionResult> {
  await requireAdmin();
  if (!input.name.trim() || input.retail_price <= 0 || input.wholesale_price <= 0) {
    return { ok: false, error: "กรอกชื่อและราคาให้ครบ" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      retail_price: input.retail_price,
      wholesale_price: input.wholesale_price,
      low_stock_threshold: input.low_stock_threshold,
    })
    .eq("id", input.id)
    .eq("kind", "tier");
  return done(error);
}

export async function addTierProduct(input: {
  name: string;
  retail_price: number;
  wholesale_price: number;
}): Promise<ActionResult> {
  await requireAdmin();
  if (!input.name.trim() || !(input.retail_price > 0) || !(input.wholesale_price > 0)) {
    return { ok: false, error: "กรอกชื่อและราคาให้ครบ" };
  }
  const supabase = await createClient();
  // ต่อท้ายกลุ่มปลีก/ส่งที่มีอยู่ (กลุ่ม "อื่นๆ" ใช้ sort_order 10 ขึ้นไป)
  const { data: last } = await supabase
    .from("products")
    .select("sort_order")
    .eq("kind", "tier")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("products").insert({
    kind: "tier",
    name: input.name.trim(),
    retail_price: input.retail_price,
    wholesale_price: input.wholesale_price,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  return done(error);
}

export async function saveOtherProduct(input: {
  id: number;
  price: number;
  low_stock_threshold: number;
}): Promise<ActionResult> {
  await requireAdmin();
  if (input.price <= 0) return { ok: false, error: "ราคาต้องมากกว่า 0" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: otherName(input.price),
      retail_price: input.price,
      wholesale_price: input.price,
      low_stock_threshold: input.low_stock_threshold,
    })
    .eq("id", input.id)
    .eq("kind", "other");
  return done(error, "มีราคานี้อยู่แล้ว (อาจถูกซ่อนไว้ ดูด้านล่าง)");
}

export async function addOtherProduct(price: number): Promise<ActionResult> {
  await requireAdmin();
  if (!(price > 0)) return { ok: false, error: "ราคาต้องมากกว่า 0" };
  const supabase = await createClient();

  // ราคานี้เคยมีแต่ถูกซ่อนไว้ -> แสดงอันเดิมกลับมา (stock และประวัติต่อจากของเดิม)
  const { data: existing } = await supabase
    .from("products")
    .select("id, is_active")
    .eq("kind", "other")
    .eq("retail_price", price)
    .maybeSingle();
  if (existing?.is_active) return { ok: false, error: "มีราคานี้อยู่แล้ว" };
  if (existing) {
    const { error } = await supabase.from("products").update({ is_active: true }).eq("id", existing.id);
    return done(error);
  }

  const { error } = await supabase.from("products").insert({
    kind: "other",
    name: otherName(price),
    retail_price: price,
    wholesale_price: price,
    sort_order: 10,
  });
  return done(error);
}

export async function setProductActive(id: number, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", id);
  return done(error);
}

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

export async function addSupplier(name: string): Promise<ActionResult> {
  await requireAdmin();
  if (!cleanName(name)) return { ok: false, error: "กรุณาใส่ชื่อร้าน" };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({ name: cleanName(name) });
  return done(error, "มีร้านชื่อนี้อยู่แล้ว");
}

/** เปลี่ยนชื่อร้าน (แก้ชื่อในประวัติการซื้อด้วย) ถ้าชื่อซ้ำกับร้านที่มีอยู่จะรวมเป็นร้านเดียว */
export async function renameSupplier(id: number, name: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_supplier", { p_id: id, p_name: name });
  return done(error);
}

export async function setSupplierActive(id: number, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ is_active: active }).eq("id", id);
  return done(error);
}
