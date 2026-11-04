"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { QR_IMAGE_BUCKET, type Product, type QrMethod } from "@/lib/types";
import type { ActionResult } from "../stock/actions";
import {
  addOtherProduct,
  addSupplier,
  addTierProduct,
  renameSupplier,
  saveOtherProduct,
  saveQrSettings,
  saveTierProduct,
  setProductActive,
  setSupplierActive,
} from "./actions";

export type Supplier = { id: number; name: string; is_active: boolean };

// ต้องตรงกับที่ตั้งไว้ใน bucket payment-qr
const QR_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const QR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function useAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  function run(fn: () => Promise<ActionResult>, okText = "บันทึกแล้ว") {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
    });
  }
  const view = message && (
    <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
  );
  return { pending, run, view };
}

export function TierProductForm({ product }: { product: Product }) {
  const [name, setName] = useState(product.name);
  const [retail, setRetail] = useState(String(product.retail_price));
  const [wholesale, setWholesale] = useState(String(product.wholesale_price));
  const [threshold, setThreshold] = useState(String(product.low_stock_threshold));
  const { pending, run, view } = useAction();

  return (
    <div className="card space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 sm:col-span-1">
          <span className="label">ชื่อกลุ่ม</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="label">ราคาปลีก</span>
          <input className="input" type="number" inputMode="decimal" value={retail} onChange={(e) => setRetail(e.target.value)} />
        </label>
        <label>
          <span className="label">ราคาส่ง</span>
          <input className="input" type="number" inputMode="decimal" value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className="label">เตือนเมื่อเหลือ ≤ (ชิ้น)</span>
          <input className="input" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveTierProduct({
                id: product.id,
                name,
                retail_price: Number(retail),
                wholesale_price: Number(wholesale),
                low_stock_threshold: Number(threshold) || 0,
              }),
            )
          }
        >
          บันทึก
        </button>
        <button
          className="btn-ghost"
          disabled={pending}
          onClick={() => run(() => setProductActive(product.id, false), "ซ่อนแล้ว")}
        >
          ซ่อน
        </button>
        {view}
      </div>
    </div>
  );
}

export function AddTierProductForm({ hidden }: { hidden: Product[] }) {
  const [name, setName] = useState("");
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");
  const { pending, run, view } = useAction();
  const canAdd = name.trim() !== "" && Number(retail) > 0 && Number(wholesale) > 0;

  return (
    <div className="card space-y-3 border-dashed">
      <h3 className="font-bold">+ เพิ่มกลุ่มราคาใหม่</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 sm:col-span-1">
          <span className="label">ชื่อกลุ่ม</span>
          <input className="input" placeholder="เช่น ขนมเปี๊ยะ" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="label">ราคาปลีก</span>
          <input className="input" type="number" inputMode="decimal" value={retail} onChange={(e) => setRetail(e.target.value)} />
        </label>
        <label>
          <span className="label">ราคาส่ง</span>
          <input className="input" type="number" inputMode="decimal" value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button
            className="btn-primary w-full"
            disabled={pending || !canAdd}
            onClick={() => {
              run(
                () => addTierProduct({ name, retail_price: Number(retail), wholesale_price: Number(wholesale) }),
                `เพิ่ม ${name.trim()} ${wholesale}/${retail} แล้ว`,
              );
              setName("");
              setRetail("");
              setWholesale("");
            }}
          >
            + เพิ่ม
          </button>
        </div>
      </div>
      {view}

      {hidden.length > 0 && (
        <div className="border-t border-stone-200 pt-3">
          <p className="mb-2 text-sm text-stone-500">กลุ่มที่ซ่อนไว้ (ไม่แสดงตอนขาย)</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((p) => (
              <button
                key={p.id}
                className="btn-ghost px-3 py-1.5 text-sm"
                disabled={pending}
                onClick={() => run(() => setProductActive(p.id, true), `แสดง ${p.name} แล้ว`)}
              >
                {p.name} {baht(p.wholesale_price)}/{baht(p.retail_price)} (เหลือ {p.qty_on_hand}) · แสดง
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuppliersForm({ suppliers }: { suppliers: Supplier[] }) {
  const [newName, setNewName] = useState("");
  const { pending, run, view } = useAction();
  const active = suppliers.filter((s) => s.is_active);
  const hidden = suppliers.filter((s) => !s.is_active);

  return (
    <div className="card space-y-4">
      {active.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {active.map((s) => (
            <SupplierRow key={s.id} supplier={s} />
          ))}
        </ul>
      ) : (
        <p className="text-stone-500">ยังไม่มีร้าน</p>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-stone-200 pt-4">
        <label className="flex-1">
          <span className="label">เพิ่มร้านใหม่</span>
          <input className="input" placeholder="เช่น ร้านจิน" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <button
          className="btn-primary"
          disabled={pending || newName.trim() === ""}
          onClick={() => {
            run(() => addSupplier(newName), `เพิ่ม ${newName.trim()} แล้ว`);
            setNewName("");
          }}
        >
          + เพิ่ม
        </button>
      </div>
      {view}

      {hidden.length > 0 && (
        <div className="border-t border-stone-200 pt-3">
          <p className="mb-2 text-sm text-stone-500">ร้านที่ซ่อนไว้ (ไม่แสดงตอนเพิ่ม stock แต่ประวัติยังอยู่)</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((s) => (
              <button
                key={s.id}
                className="btn-ghost px-3 py-1.5 text-sm"
                disabled={pending}
                onClick={() => run(() => setSupplierActive(s.id, true), `แสดง ${s.name} แล้ว`)}
              >
                {s.name} · แสดง
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierRow({ supplier }: { supplier: Supplier }) {
  const [name, setName] = useState(supplier.name);
  const { pending, run, view } = useAction();
  const changed = name.trim() !== supplier.name;

  return (
    <li className="flex flex-wrap items-center gap-2 py-3">
      <input className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="btn-primary"
        disabled={pending || !changed || name.trim() === ""}
        onClick={() => run(() => renameSupplier(supplier.id, name), "เปลี่ยนชื่อแล้ว (ประวัติการซื้อเปลี่ยนตามด้วย)")}
      >
        เปลี่ยนชื่อ
      </button>
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() => run(() => setSupplierActive(supplier.id, false), "ซ่อนแล้ว")}
      >
        ซ่อน
      </button>
      <div className="w-full">{view}</div>
    </li>
  );
}

export function OtherProductsForm({ products }: { products: Product[] }) {
  const [newPrice, setNewPrice] = useState("");
  const { pending, run, view } = useAction();
  const active = products.filter((p) => p.is_active);
  const hidden = products.filter((p) => !p.is_active);

  return (
    <div className="card space-y-4">
      <ul className="divide-y divide-stone-100">
        {active.map((p) => (
          <OtherRow key={p.id} product={p} />
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2 border-t border-stone-200 pt-4">
        <label className="flex-1">
          <span className="label">เพิ่มราคาใหม่ (บาท)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
        </label>
        <button
          className="btn-primary"
          disabled={pending || !(Number(newPrice) > 0)}
          onClick={() => {
            run(() => addOtherProduct(Number(newPrice)), `เพิ่มราคา ${newPrice} บาทแล้ว`);
            setNewPrice("");
          }}
        >
          + เพิ่ม
        </button>
      </div>
      {view}

      {hidden.length > 0 && (
        <div className="border-t border-stone-200 pt-3">
          <p className="mb-2 text-sm text-stone-500">ราคาที่ซ่อนไว้ (ไม่แสดงตอนขาย)</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((p) => (
              <button
                key={p.id}
                className="btn-ghost px-3 py-1.5 text-sm"
                disabled={pending}
                onClick={() => run(() => setProductActive(p.id, true), `แสดง ${p.name} แล้ว`)}
              >
                {baht(p.retail_price)} บาท (เหลือ {p.qty_on_hand}) · แสดง
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OtherRow({ product }: { product: Product }) {
  const [price, setPrice] = useState(String(product.retail_price));
  const [threshold, setThreshold] = useState(String(product.low_stock_threshold));
  const { pending, run, view } = useAction();

  return (
    <li className="flex flex-wrap items-end gap-2 py-3">
      <label className="w-28">
        <span className="label">ราคา</span>
        <input className="input" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label className="w-28">
        <span className="label">เตือน ≤</span>
        <input className="input" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </label>
      <span className="pb-3 text-sm text-stone-500">เหลือ {product.qty_on_hand}</span>
      <div className="ml-auto flex gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveOtherProduct({ id: product.id, price: Number(price), low_stock_threshold: Number(threshold) || 0 }),
            )
          }
        >
          บันทึก
        </button>
        <button
          className="btn-ghost"
          disabled={pending}
          onClick={() => run(() => setProductActive(product.id, false), "ซ่อนแล้ว")}
        >
          ซ่อน
        </button>
      </div>
      <div className="w-full">{view}</div>
    </li>
  );
}

export function QrSettingsForm({
  initial,
}: {
  initial: { method: QrMethod; promptpayId: string; imagePath: string | null; imageUrl: string | null };
}) {
  const [method, setMethod] = useState(initial.method);
  const [promptpayId, setPromptpayId] = useState(initial.promptpayId);
  const [imagePath, setImagePath] = useState(initial.imagePath);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState(initial.imageUrl);
  const [dragging, setDragging] = useState(false);
  const { pending, run, view } = useAction();

  function pickFile(picked: File | undefined) {
    // กดยกเลิกหน้าเลือกไฟล์ ให้คงรูปเดิมไว้
    if (!picked) return;
    // ลากไฟล์มาวางจะไม่ผ่านตัวกรอง accept จึงต้องตรวจที่นี่
    if (!QR_IMAGE_TYPES[picked.type]) {
      setFileError("รองรับเฉพาะรูป PNG, JPG หรือ WEBP");
      return;
    }
    if (picked.size > QR_IMAGE_MAX_BYTES) {
      setFileError("รูปต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setFileError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function save(): Promise<ActionResult> {
    let path = imagePath;
    let uploaded: string | null = null;
    const supabase = createClient();
    // อัปโหลดจากเบราว์เซอร์โดยตรง เพราะ server action รับไฟล์ได้ไม่เกิน 1 MB
    if (method === "image" && file) {
      uploaded = `${Date.now()}.${QR_IMAGE_TYPES[file.type]}`;
      const { error } = await supabase.storage.from(QR_IMAGE_BUCKET).upload(uploaded, file);
      if (error) return { ok: false, error: `อัปโหลดรูปไม่สำเร็จ: ${error.message}` };
      path = uploaded;
    }
    const res = await saveQrSettings({ method, promptpayId, imagePath: path });
    if (res.ok) {
      setImagePath(path);
      if (uploaded) setFile(null);
    } else if (uploaded) {
      await supabase.storage.from(QR_IMAGE_BUCKET).remove([uploaded]);
    }
    return res;
  }

  const methods: { value: QrMethod; title: string; detail: string }[] = [
    { value: "promptpay", title: "พร้อมเพย์", detail: "สร้าง QR พร้อมยอดเงินให้อัตโนมัติ" },
    { value: "image", title: "รูป QR จากธนาคาร", detail: "แนบรูป ลูกค้ากรอกยอดเงินเอง" },
  ];

  return (
    <div className="card space-y-4">
      <fieldset>
        <legend className="label">QR ที่ให้ลูกค้าสแกนตอนจ่าย</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {methods.map((m) => (
            <label
              key={m.value}
              className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 transition hover:bg-stone-50 has-checked:border-amber-500 has-checked:bg-amber-50 has-checked:ring-1 has-checked:ring-amber-500 has-focus-visible:ring-2 has-focus-visible:ring-amber-300"
            >
              <input
                type="radio"
                name="qr-method"
                className="mt-1 size-4 accent-amber-500"
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
              />
              <span>
                <span className="block font-semibold text-stone-800">{m.title}</span>
                <span className="block text-sm text-stone-500">{m.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === "promptpay" ? (
        <>
          <label className="block">
            <span className="label">เบอร์โทร หรือเลขบัตรประชาชนที่ผูกพร้อมเพย์</span>
            <input
              className="input"
              inputMode="numeric"
              value={promptpayId}
              onChange={(e) => setPromptpayId(e.target.value)}
            />
          </label>
          <p className="text-sm text-stone-500">ห้ามกรอกเลขบัญชีธนาคารในช่องนี้ เงินอาจเข้าบัญชีคนอื่น</p>
        </>
      ) : (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files[0]);
            }}
            className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition has-focus-visible:ring-2 has-focus-visible:ring-amber-300 ${
              dragging
                ? "border-amber-500 bg-amber-50"
                : "border-stone-300 bg-stone-50/60 hover:border-amber-400 hover:bg-amber-50/40"
            }`}
          >
            <input
              className="sr-only"
              type="file"
              accept={Object.keys(QR_IMAGE_TYPES).join(",")}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                // ล้างค่า เพื่อให้เลือกไฟล์เดิมซ้ำได้
                e.target.value = "";
              }}
            />
            {preview ? (
              <div className="flex flex-col items-center gap-4">
                <Image
                  src={preview}
                  alt="ตัวอย่างรูป QR"
                  width={240}
                  height={320}
                  unoptimized
                  className="h-auto max-h-80 w-auto max-w-full rounded-xl bg-white object-contain shadow-md ring-1 ring-stone-200"
                />
                <div className="min-w-0 space-y-1 text-center">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                    </svg>
                    เปลี่ยนรูป
                  </span>
                  {/* เตือนเฉพาะตอนมีรูปใหม่ที่ยังไม่บันทึก */}
                  <p className={`text-sm break-all ${file ? "font-medium text-amber-800" : "text-stone-500"}`}>
                    {file ? `${file.name} — กดบันทึกเพื่อใช้รูปนี้` : "แตะที่นี่ หรือลากไฟล์ใหม่มาวาง"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                  </svg>
                </span>
                <span className="font-semibold text-stone-800">แตะเพื่อเลือกรูป QR</span>
                <span className="text-sm text-stone-500">หรือลากไฟล์มาวาง · PNG, JPG, WEBP ไม่เกิน 5 MB</span>
              </div>
            )}
          </label>
          {fileError && <p className="text-sm text-red-600">{fileError}</p>}
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ลูกค้าต้องกรอกยอดเงินเอง ลองสแกนจ่ายยอดเล็ก ๆ และดูชื่อผู้รับก่อนใช้จริง
          </p>
        </>
      )}

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending} onClick={() => run(save)}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {view}
      </div>
    </div>
  );
}
