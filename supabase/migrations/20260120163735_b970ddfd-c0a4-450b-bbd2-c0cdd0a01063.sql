-- 1. Add explicit DENY policies for subscription_secrets (INSERT, UPDATE, DELETE)
CREATE POLICY "No direct insert to subscription secrets"
  ON public.subscription_secrets FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct update to subscription secrets"
  ON public.subscription_secrets FOR UPDATE
  USING (false);

CREATE POLICY "No direct delete from subscription secrets"
  ON public.subscription_secrets FOR DELETE
  USING (false);

-- 2. Restrict user_milestones - make INSERT only via service role by denying direct inserts
DROP POLICY IF EXISTS "Users can insert their own milestones" ON public.user_milestones;

CREATE POLICY "Users can insert milestones via backend only"
  ON public.user_milestones FOR INSERT
  WITH CHECK (false);

-- 3. Restrict user_perks - make INSERT only via service role
DROP POLICY IF EXISTS "Users can insert their own perks" ON public.user_perks;

CREATE POLICY "Users can insert perks via backend only"
  ON public.user_perks FOR INSERT
  WITH CHECK (false);

-- 4. Add explicit DENY policies for credits_purchases UPDATE and DELETE
CREATE POLICY "No update to credits purchases"
  ON public.credits_purchases FOR UPDATE
  USING (false);

CREATE POLICY "No delete from credits purchases"
  ON public.credits_purchases FOR DELETE
  USING (false);