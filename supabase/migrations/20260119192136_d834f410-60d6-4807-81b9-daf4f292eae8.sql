-- Create atomic credit deduction function to prevent race conditions
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, current_balance INTEGER) AS $$
DECLARE
  v_new_balance INTEGER;
  v_current_balance INTEGER;
BEGIN
  -- Get current balance first for logging
  SELECT ai_credits_balance INTO v_current_balance
  FROM public.user_tokens
  WHERE user_id = p_user_id;
  
  -- Atomic update with balance check in WHERE clause
  UPDATE public.user_tokens
  SET 
    ai_credits_balance = ai_credits_balance - p_amount,
    ai_credits_used = ai_credits_used + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND ai_credits_balance >= p_amount
  RETURNING ai_credits_balance INTO v_new_balance;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_new_balance, COALESCE(v_current_balance, 0);
  ELSE
    RETURN QUERY SELECT FALSE, -1, COALESCE(v_current_balance, 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;