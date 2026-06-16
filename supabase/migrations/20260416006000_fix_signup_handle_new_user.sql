CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotent profile creation to avoid "Database error saving new user"
  INSERT INTO public.profiles (user_id, email, full_name)
  SELECT NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.id
  );

  -- Ensure default user role exists
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'user'::public.app_role
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.id
      AND ur.role = 'user'::public.app_role
  );

  -- Ensure token wallet exists for new users
  INSERT INTO public.user_tokens (user_id, balance, ai_credits_balance)
  SELECT NEW.id, 100, 1000
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_tokens ut WHERE ut.user_id = NEW.id
  );

  RETURN NEW;
END;
$$;
