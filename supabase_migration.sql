-- ============================================
-- COMPLETE SUPABASE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CREATE ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'creator', 'pro');

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    role app_role NOT NULL DEFAULT 'user'::app_role,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    plan subscription_plan NOT NULL DEFAULT 'free'::subscription_plan,
    status text NOT NULL DEFAULT 'active'::text,
    billing_cycle text NOT NULL DEFAULT 'monthly'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_start timestamp with time zone NOT NULL DEFAULT now(),
    current_period_end timestamp with time zone NOT NULL DEFAULT (now() + '1 mon'::interval),
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    has_used_free_trial boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User tokens table
CREATE TABLE public.user_tokens (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    balance integer NOT NULL DEFAULT 0,
    total_earned integer NOT NULL DEFAULT 0,
    total_spent integer NOT NULL DEFAULT 0,
    current_xp integer NOT NULL DEFAULT 0,
    ai_credits_balance integer NOT NULL DEFAULT 0,
    ai_credits_used integer NOT NULL DEFAULT 0,
    display_name text,
    show_on_leaderboard boolean NOT NULL DEFAULT true,
    displayed_badges uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    keywords_used integer DEFAULT 0,
    topics_generated integer DEFAULT 0,
    scripts_generated integer DEFAULT 0,
    thumbnails_generated integer DEFAULT 0,
    channel_analyses integer DEFAULT 0,
    competitor_analyses integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, date)
);

-- AI credits usage table
CREATE TABLE public.ai_credits_usage (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    query_type text NOT NULL,
    query_complexity text NOT NULL,
    credits_used integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Credits history table
CREATE TABLE public.credits_history (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    type text NOT NULL,
    amount integer NOT NULL,
    balance_after integer,
    description text,
    related_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Credit packages table
CREATE TABLE public.credit_packages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    credits_amount integer NOT NULL,
    token_cost integer,
    price_usd numeric,
    stripe_price_id text,
    bonus_percentage integer DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Credits purchases table
CREATE TABLE public.credits_purchases (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    package_id uuid,
    credits_amount integer NOT NULL,
    tokens_spent integer,
    amount_usd numeric,
    payment_method text NOT NULL,
    stripe_payment_id text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Growth tasks table
CREATE TABLE public.growth_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    tier text NOT NULL DEFAULT 'basic'::text,
    difficulty text NOT NULL DEFAULT 'easy'::text,
    xp_reward integer NOT NULL DEFAULT 50,
    token_reward integer NOT NULL DEFAULT 10,
    is_recurring boolean NOT NULL DEFAULT false,
    reset_frequency text,
    verification_metric text,
    verification_operator text,
    verification_threshold numeric,
    verification_window_days integer,
    recurrence_days integer,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User task progress table
CREATE TABLE public.user_task_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    verified_at timestamp with time zone,
    claimed_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_completed_at timestamp with time zone,
    completion_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, task_id)
);

-- Recurring task completions table
CREATE TABLE public.recurring_task_completions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    verified_at timestamp with time zone,
    claimed_at timestamp with time zone,
    completed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI-generated growth task sets
CREATE TABLE public.user_growth_task_sets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    step_index integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_growth_task_sets_user_id_idx
    ON public.user_growth_task_sets (user_id, step_index DESC);

-- AI-generated growth tasks
CREATE TABLE public.user_growth_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_set_id uuid NOT NULL REFERENCES public.user_growth_task_sets(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    difficulty text NOT NULL DEFAULT 'easy'::text,
    token_reward integer NOT NULL DEFAULT 10,
    xp_reward integer NOT NULL DEFAULT 50,
    order_index integer NOT NULL DEFAULT 0,
    verification_metric text,
    verification_operator text,
    verification_threshold numeric,
    verification_window_days integer,
    verified_at timestamp with time zone,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_growth_tasks_set_idx
    ON public.user_growth_tasks (task_set_id, order_index);

-- Milestones table
CREATE TABLE public.milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    tier text NOT NULL DEFAULT 'basic'::text,
    required_xp integer NOT NULL,
    token_reward integer NOT NULL DEFAULT 50,
    icon text,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User milestones table
CREATE TABLE public.user_milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    milestone_id uuid NOT NULL,
    unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
    claimed boolean NOT NULL DEFAULT false,
    claimed_at timestamp with time zone,
    UNIQUE (user_id, milestone_id)
);

-- Badges table
CREATE TABLE public.badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    icon text NOT NULL,
    color text NOT NULL DEFAULT 'primary'::text,
    rarity text NOT NULL DEFAULT 'common'::text,
    requirement_type text NOT NULL DEFAULT 'milestone'::text,
    requirement_value jsonb,
    milestone_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User badges table
CREATE TABLE public.user_badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone NOT NULL DEFAULT now(),
    is_displayed boolean NOT NULL DEFAULT false,
    display_order integer,
    UNIQUE (user_id, badge_id)
);

-- Perks table
CREATE TABLE public.perks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    perk_type text NOT NULL,
    perk_value jsonb,
    token_cost integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User perks table
CREATE TABLE public.user_perks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    perk_id uuid NOT NULL,
    unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone
);

-- YouTube channels table
CREATE TABLE public.youtube_channels (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    channel_id text NOT NULL,
    channel_name text,
    channel_url text,
    thumbnail_url text,
    channel_thumbnail text,
    subscriber_count integer DEFAULT 0,
    video_count integer DEFAULT 0,
    view_count bigint DEFAULT 0,
    is_primary boolean DEFAULT false,
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- 3. CREATE VIEWS
-- ============================================

-- Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
    ut.user_id,
    ut.display_name,
    p.avatar_url,
    ut.current_xp,
    ut.balance AS token_balance,
    ut.total_earned AS tokens_earned,
    ROW_NUMBER() OVER (ORDER BY ut.current_xp DESC) AS xp_rank,
    ROW_NUMBER() OVER (ORDER BY ut.total_earned DESC) AS tokens_rank
FROM public.user_tokens ut
LEFT JOIN public.profiles p ON p.user_id = ut.user_id
WHERE ut.show_on_leaderboard = true;

-- User subscription summary view
CREATE OR REPLACE VIEW public.user_subscription_summary AS
SELECT 
    user_id,
    plan,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    trial_ends_at,
    created_at,
    updated_at
FROM public.subscriptions;

-- ============================================
-- 4. CREATE FUNCTIONS
-- ============================================

-- Has role function (security definer to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update updated_at column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user function (creates profile, subscription, and role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Create free subscription with 1 month trial
  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, current_period_end)
  VALUES (NEW.id, 'free', 'trialing', now() + interval '1 month', now() + interval '1 month');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create user tokens record
  INSERT INTO public.user_tokens (user_id, balance, ai_credits_balance)
  VALUES (NEW.id, 0, 50);
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 5. CREATE TRIGGERS
-- ============================================

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON public.user_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_youtube_channels_updated_at
  BEFORE UPDATE ON public.youtube_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credits_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_growth_task_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_growth_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. CREATE RLS POLICIES
-- ============================================

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile only" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- USER ROLES POLICIES
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all subscriptions" ON public.subscriptions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update subscriptions" ON public.subscriptions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- USER TOKENS POLICIES
CREATE POLICY "Users can view their own tokens" ON public.user_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user tokens" ON public.user_tokens FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view leaderboard data" ON public.user_tokens FOR SELECT USING (show_on_leaderboard = true);
CREATE POLICY "Users can insert their own tokens" ON public.user_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tokens" ON public.user_tokens FOR UPDATE USING (auth.uid() = user_id);

-- USAGE TRACKING POLICIES
CREATE POLICY "Users can view their own usage" ON public.usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.usage_tracking FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own usage" ON public.usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own usage" ON public.usage_tracking FOR UPDATE USING (auth.uid() = user_id);

-- AI CREDITS USAGE POLICIES
CREATE POLICY "Users can view their own credits usage" ON public.ai_credits_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all credits usage" ON public.ai_credits_usage FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own credits usage" ON public.ai_credits_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CREDITS HISTORY POLICIES
CREATE POLICY "Users can view their own credits history" ON public.credits_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all credits history" ON public.credits_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own credits history" ON public.credits_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CREDIT PACKAGES POLICIES
CREATE POLICY "Anyone can view credit packages" ON public.credit_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage credit packages" ON public.credit_packages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- CREDITS PURCHASES POLICIES
CREATE POLICY "Users can view their own purchases" ON public.credits_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own purchases" ON public.credits_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- GROWTH TASKS POLICIES
CREATE POLICY "Anyone can view growth tasks" ON public.growth_tasks FOR SELECT USING (true);
CREATE POLICY "Admins can manage growth tasks" ON public.growth_tasks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- USER TASK PROGRESS POLICIES
CREATE POLICY "Users can view their own task progress" ON public.user_task_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all task progress" ON public.user_task_progress FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own task progress" ON public.user_task_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own task progress" ON public.user_task_progress FOR UPDATE USING (auth.uid() = user_id);

-- RECURRING TASK COMPLETIONS POLICIES
CREATE POLICY "Users can view their own recurring completions" ON public.recurring_task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recurring completions" ON public.recurring_task_completions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own recurring completions" ON public.recurring_task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER GROWTH TASK SETS POLICIES
CREATE POLICY "Users can view own growth task sets" ON public.user_growth_task_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own growth task sets" ON public.user_growth_task_sets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER GROWTH TASKS POLICIES
CREATE POLICY "Users can view own growth tasks" ON public.user_growth_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own growth tasks" ON public.user_growth_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own growth tasks" ON public.user_growth_tasks FOR UPDATE USING (auth.uid() = user_id);

-- MILESTONES POLICIES
CREATE POLICY "Anyone can view milestones" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Admins can manage milestones" ON public.milestones FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- USER MILESTONES POLICIES
CREATE POLICY "Users can view their own milestones" ON public.user_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own milestones" ON public.user_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own milestones" ON public.user_milestones FOR UPDATE USING (auth.uid() = user_id);

-- BADGES POLICIES
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- USER BADGES POLICIES
CREATE POLICY "Users can view all user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own badges" ON public.user_badges FOR UPDATE USING (auth.uid() = user_id);

-- PERKS POLICIES
CREATE POLICY "Anyone can view perks" ON public.perks FOR SELECT USING (true);
CREATE POLICY "Admins can manage perks" ON public.perks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- USER PERKS POLICIES
CREATE POLICY "Users can view their own perks" ON public.user_perks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own perks" ON public.user_perks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- YOUTUBE CHANNELS POLICIES
CREATE POLICY "Users can view their own channels" ON public.youtube_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all channels" ON public.youtube_channels FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own channels" ON public.youtube_channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own channels" ON public.youtube_channels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own channels" ON public.youtube_channels FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
