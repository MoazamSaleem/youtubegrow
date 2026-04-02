-- Expand allowed subscription statuses to match app lifecycle handling

ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN ('active', 'cancelled', 'expired', 'trialing', 'pending', 'inactive'));
