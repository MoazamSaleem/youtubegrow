-- Add column to track if user has used their free trial
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS has_used_free_trial boolean DEFAULT false;

-- Update existing free plan users to mark them as having used free trial
UPDATE public.subscriptions 
SET has_used_free_trial = true 
WHERE plan = 'free' AND has_used_free_trial IS NULL;

-- Add trial_started_at column to track when trial began
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone;