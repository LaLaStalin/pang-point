import { DateField } from "./DateField";

/** ฟอร์มเลือกช่วงวันที่ (GET) */
export function DateRangeFilter({
  from,
  to,
  extra,
}: {
  from: string;
  to: string;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" method="get">
      {Object.entries(extra ?? {}).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <label>
        <span className="label">ตั้งแต่</span>
        <DateField name="from" defaultValue={from} />
      </label>
      <label>
        <span className="label">ถึง</span>
        <DateField name="to" defaultValue={to} />
      </label>
      <button className="btn-primary">ดู</button>
    </form>
  );
}
