DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('moazamm.dev@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email moazamm.dev@gmail.com was not found in auth.users.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END
$$;
