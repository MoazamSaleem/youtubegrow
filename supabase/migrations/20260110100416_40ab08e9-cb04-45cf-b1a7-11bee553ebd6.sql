-- Create credits_history table to track all credit changes
CREATE TABLE public.credits_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'subscription', 'purchase', 'usage', 'refund', 'bonus'
  description TEXT,
  balance_after INTEGER,
  related_id UUID, -- Reference to purchase/usage record
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credits_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own credits history"
  ON public.credits_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits history"
  ON public.credits_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all credits history"
  ON public.credits_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_credits_history_user_id ON public.credits_history(user_id);
CREATE INDEX idx_credits_history_created_at ON public.credits_history(created_at DESC);