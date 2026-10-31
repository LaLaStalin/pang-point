-- ยอดขายรายวัน (ตามวันที่เวลาไทย) สำหรับกราฟหน้าภาพรวม — วันที่ไม่มียอดขายได้ 0
create or replace function public.daily_sales(p_from date, p_to date)
returns table (day date, revenue numeric, cost numeric, bills bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ยาวเกินไป';
  end if;

  return query
    with s as (
      select (sa.sold_at at time zone 'Asia/Bangkok')::date as d, sa.id, sa.total_amount
      from sales sa
      where sa.status = 'completed'
        and sa.sold_at >= (p_from::timestamp at time zone 'Asia/Bangkok')
        and sa.sold_at < ((p_to + 1)::timestamp at time zone 'Asia/Bangkok')
    ),
    rev as (
      select s.d, sum(s.total_amount) as revenue, count(*) as bills from s group by s.d
    ),
    cst as (
      select s.d, round(sum(si.qty * si.unit_cost), 2) as cost
      from s join sale_items si on si.sale_id = s.id
      group by s.d
    )
    select g.d::date,
           coalesce(rev.revenue, 0),
           coalesce(cst.cost, 0),
           coalesce(rev.bills, 0)
    from generate_series(p_from, p_to, interval '1 day') g(d)
    left join rev on rev.d = g.d::date
    left join cst on cst.d = g.d::date
    order by 1;
end $$;

revoke execute on function public.daily_sales(date, date) from public, anon;
grant execute on function public.daily_sales(date, date) to authenticated;
