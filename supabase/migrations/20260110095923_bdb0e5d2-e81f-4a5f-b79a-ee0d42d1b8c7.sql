-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a cron job to call check-trial-expiration daily at 9:00 AM UTC
SELECT cron.schedule(
  'check-trial-expiration-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jxhnuoclxreghspjrffk.supabase.co/functions/v1/check-trial-expiration',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);