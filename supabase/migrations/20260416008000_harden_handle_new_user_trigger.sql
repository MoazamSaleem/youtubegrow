-- Harden signup trigger so auth user creation does not fail due to
-- duplicate/profile/token bootstrap edge cases.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Profile: upsert-like behavior by user_id to avoid duplicate errors.
  BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    SELECT NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  -- Default role.
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.id, 'user'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.id
        AND ur.role = 'user'::public.app_role
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: role insert failed for %: %', NEW.id, SQLERRM;
  END;

  -- Token wallet bootstrap.
  BEGIN
    INSERT INTO public.user_tokens (user_id)
    SELECT NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_tokens ut WHERE ut.user_id = NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: user_tokens insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Ensure exactly one active trigger path for this function.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
      AND tgfoid = 'public.handle_new_user()'::regprocedure
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', r.tgname);
  END LOOP;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
END
$$;
