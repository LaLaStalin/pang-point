"use client";

import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { ActionResult } from "../stock/actions";
import {
  addOtherProduct,
  addSupplier,
  addTierProduct,
  renameSupplier,
  saveOtherProduct,
  savePromptpay,
  saveTierProduct,
  setProductActive,
  setSupplierActive,
} from "./actions";

export type Supplier = { id: number; name: string; is_active: boolean };

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

export function PromptpayForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { pending, run, view } = useAction();
  return (
    <div className="card space-y-3">
      <label>
        <span className="label">เบอร์โทร หรือเลขบัตรประชาชนที่ผูกพร้อมเพย์</span>
        <input className="input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <p className="text-sm text-stone-500">ใช้สร้าง QR พร้อมยอดเงินให้ลูกค้าสแกนตอนจ่าย</p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending} onClick={() => run(() => savePromptpay(value))}>
          บันทึก
        </button>
        {view}
      </div>
    </div>
  );
}
