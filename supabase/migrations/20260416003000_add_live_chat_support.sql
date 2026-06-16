CREATE TABLE IF NOT EXISTS public.support_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.support_chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_sessions_user_updated
  ON public.support_chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_session_created
  ON public.support_chat_messages(session_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.update_support_chat_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_chat_sessions
  SET
    updated_at = now(),
    last_message_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_support_chat_session_timestamp ON public.support_chat_messages;
CREATE TRIGGER trg_update_support_chat_session_timestamp
AFTER INSERT ON public.support_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_support_chat_session_timestamp();

ALTER TABLE public.support_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support chat sessions" ON public.support_chat_sessions;
CREATE POLICY "Users can view own support chat sessions"
ON public.support_chat_sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own support chat sessions" ON public.support_chat_sessions;
CREATE POLICY "Users can create own support chat sessions"
ON public.support_chat_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all support chat sessions" ON public.support_chat_sessions;
CREATE POLICY "Admins can view all support chat sessions"
ON public.support_chat_sessions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update support chat sessions" ON public.support_chat_sessions;
CREATE POLICY "Admins can update support chat sessions"
ON public.support_chat_sessions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own support chat messages" ON public.support_chat_messages;
CREATE POLICY "Users can view own support chat messages"
ON public.support_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.support_chat_sessions s
    WHERE s.id = session_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send messages to own support chat" ON public.support_chat_messages;
CREATE POLICY "Users can send messages to own support chat"
ON public.support_chat_messages
FOR INSERT
WITH CHECK (
  sender = 'user'
  AND EXISTS (
    SELECT 1
    FROM public.support_chat_sessions s
    WHERE s.id = session_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all support chat messages" ON public.support_chat_messages;
CREATE POLICY "Admins can manage all support chat messages"
ON public.support_chat_messages
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
  END IF;
END
$$;
