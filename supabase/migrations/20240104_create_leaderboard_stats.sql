-- Function to get ranked leaderboard with optional date filter
create or replace function get_leaderboard_stats(
  sort_by text default 'pixels',  -- 'pixels' or 'spending'
  limit_count int default 100,
  start_date timestamptz default null
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  pixel_count bigint,
  total_spent numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select
    p.owner_id as user_id,
    pr.full_name,
    pr.avatar_url,
    count(p.id) as pixel_count,
    coalesce(sum(p.price_paid), 0) as total_spent
  from
    pixels p
    left join profiles pr on p.owner_id = pr.user_id
  where
    p.owner_id is not null
    and (start_date is null or p.purchased_at >= start_date)
  group by
    p.owner_id,
    pr.full_name,
    pr.avatar_url
  order by
    case when sort_by = 'pixels' then count(p.id) end desc,
    case when sort_by = 'spending' then sum(p.price_paid) end desc
  limit limit_count;
end;
$$;

-- Function to get general stats
create or replace function get_general_stats()
returns table (
  total_pixels_sold bigint,
  total_revenue numeric,
  total_users bigint,
  average_price numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select
    count(p.id) as total_pixels_sold,
    coalesce(sum(p.price_paid), 0) as total_revenue,
    count(distinct p.owner_id) as total_users,
    coalesce(avg(p.price_paid), 0) as average_price
  from
    pixels p
  where
    p.owner_id is not null;
end;
$$;
