-- RPC function to atomically increment daily research count
-- Mirrors increment_daily_message_count pattern
-- Resolves missing function that caused PGRST202 error and rate limit bypass

CREATE OR REPLACE FUNCTION increment_daily_research_count(
  p_user_id TEXT,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_research_counts (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = daily_research_counts.count + 1;
END;
$$;
