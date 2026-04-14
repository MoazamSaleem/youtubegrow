-- Legacy migration intentionally left blank after free-trial removal.

-- Add trial_started_at column to track when trial began
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone;
