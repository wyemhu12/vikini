-- RPC function to atomically increment daily message count
-- Resolves race condition in read-then-write pattern

create or replace function increment_daily_message_count(
  p_user_id text,
  p_date date
)
returns void
language plpgsql
security definer
as $$
begin
  insert into daily_message_counts (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set 
    count = daily_message_counts.count + 1;
end;
$$;
