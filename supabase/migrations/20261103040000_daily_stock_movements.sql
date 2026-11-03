-- จำนวนชิ้นรายวัน (ตามวันที่เวลาไทย) แยกตามประเภท สำหรับกราฟหน้าประวัติ stock — วันที่ไม่มีรายการได้ 0
create or replace function public.daily_stock_movements(p_from date, p_to date)
returns table (day date, purchase_qty integer, sale_qty integer, adjust_qty integer, void_qty integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ยาวเกินไป';
  end if;

  return query
    with m as (
      select (sm.at at time zone 'Asia/Bangkok')::date as d, sm.kind, abs(sm.qty_change) as qty
      from stock_movements sm
      where sm.at >= (p_from::timestamp at time zone 'Asia/Bangkok')
        and sm.at < ((p_to + 1)::timestamp at time zone 'Asia/Bangkok')
    )
    select g.d::date,
           coalesce(sum(m.qty) filter (where m.kind = 'purchase'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.kind = 'sale'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.kind like 'adjust_%'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.kind = 'void'), 0)::integer
    from generate_series(p_from, p_to, interval '1 day') g(d)
    left join m on m.d = g.d::date
    group by g.d
    order by 1;
end $$;

revoke execute on function public.daily_stock_movements(date, date) from public, anon;
grant execute on function public.daily_stock_movements(date, date) to authenticated;
