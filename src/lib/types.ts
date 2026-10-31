export type UserRole = "admin" | "staff";
export type ProductKind = "tier" | "other";
export type PriceType = "retail" | "wholesale";
export type PaymentMethod = "cash" | "promptpay";
export type SaleStatus = "completed" | "void";
export type AdjustReason = "damaged" | "tasting" | "expired" | "other";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
};

export type Product = {
  id: number;
  kind: ProductKind;
  name: string;
  retail_price: number;
  wholesale_price: number;
  qty_on_hand: number;
  low_stock_threshold: number;
  sort_order: number;
  is_active: boolean;
};

/** จาก view products_admin — ต้นทุนเฉลี่ยอ่านได้เฉพาะ admin */
export type ProductWithCost = Product & { avg_cost: number };

export type Sale = {
  id: number;
  price_type: PriceType;
  payment_method: PaymentMethod;
  total_qty: number;
  total_amount: number;
  received_amount: number;
  change_amount: number;
  status: SaleStatus;
  sold_by: string;
  sold_at: string;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type SaleItem = {
  id: number;
  sale_id: number;
  product_id: number;
  unit_price: number;
  qty: number;
  unit_cost: number;
};

export type SalesSummary = {
  bill_count: number;
  total_qty: number;
  revenue: number;
  cost: number;
  cash_amount: number;
  promptpay_amount: number;
  retail_amount: number;
  wholesale_amount: number;
  void_count: number;
  by_product: {
    product_id: number;
    name: string;
    kind: ProductKind;
    qty: number;
    revenue: number;
    cost: number;
  }[];
  losses: { reason: AdjustReason; qty: number; cost: number }[];
};

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  retail: "ปลีก",
  wholesale: "ส่ง",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  promptpay: "พร้อมเพย์",
};

export const ADJUST_REASON_LABEL: Record<AdjustReason, string> = {
  damaged: "เสียหาย",
  tasting: "ชิม/กิน",
  expired: "หมดอายุ",
  other: "อื่นๆ",
};
