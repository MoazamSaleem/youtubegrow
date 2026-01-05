-- Add AI credits to user_tokens table
ALTER TABLE public.user_tokens 
ADD COLUMN IF NOT EXISTS ai_credits_balance integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_credits_used integer NOT NULL DEFAULT 0;

-- Add display_name to user_tokens for leaderboard (anonymized option)
ALTER TABLE public.user_tokens 
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean NOT NULL DEFAULT true;

-- Create leaderboard view with anonymization
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  ut.user_id,
  COALESCE(ut.display_name, CONCAT('Creator #', SUBSTR(ut.user_id::text, 1, 8))) as display_name,
  ut.current_xp,
  ut.total_earned as tokens_earned,
  ut.balance as token_balance,
  p.avatar_url,
  RANK() OVER (ORDER BY ut.current_xp DESC) as xp_rank,
  RANK() OVER (ORDER BY ut.total_earned DESC) as tokens_rank
FROM public.user_tokens ut
LEFT JOIN public.profiles p ON p.user_id = ut.user_id
WHERE ut.show_on_leaderboard = true
ORDER BY ut.current_xp DESC;

-- Allow all authenticated users to view leaderboard
GRANT SELECT ON public.leaderboard TO authenticated;

-- Add recurring task fields to growth_tasks
ALTER TABLE public.growth_tasks 
ADD COLUMN IF NOT EXISTS reset_frequency text CHECK (reset_frequency IN ('daily', 'weekly', 'monthly', NULL));

-- Create table for tracking recurring task completions
CREATE TABLE IF NOT EXISTS public.recurring_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.growth_tasks(id) ON DELETE CASCADE,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  UNIQUE(user_id, task_id, period_start)
);

-- Enable RLS
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;

-- Policies for recurring task completions
CREATE POLICY "Users can view their own recurring completions" 
ON public.recurring_task_completions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring completions" 
ON public.recurring_task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all recurring completions" 
ON public.recurring_task_completions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Create AI credits usage log
CREATE TABLE IF NOT EXISTS public.ai_credits_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credits_used integer NOT NULL,
  query_type text NOT NULL,
  query_complexity text NOT NULL CHECK (query_complexity IN ('basic', 'standard', 'extensive')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_credits_usage ENABLE ROW LEVEL SECURITY;

-- Policies for AI credits usage
CREATE POLICY "Users can view their own credits usage" 
ON public.ai_credits_usage FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits usage" 
ON public.ai_credits_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits usage" 
ON public.ai_credits_usage FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Insert recurring daily tasks
INSERT INTO public.growth_tasks (title, description, category, tier, token_reward, xp_reward, difficulty, order_index, is_recurring, reset_frequency) VALUES
('Daily engagement check', 'Review and respond to new comments on your videos', 'engagement', 'basic', 5, 25, 'easy', 101, true, 'daily'),
('Check analytics', 'Review your channel analytics and note key insights', 'analytics', 'basic', 5, 25, 'easy', 102, true, 'daily'),
('Content brainstorm', 'Spend 10 minutes brainstorming new video ideas', 'content', 'basic', 5, 25, 'easy', 103, true, 'daily'),
('Community interaction', 'Engage with 3 videos in your niche', 'networking', 'pro', 10, 50, 'easy', 104, true, 'daily'),
('Trend research', 'Research trending topics in your niche', 'research', 'pro', 10, 50, 'medium', 105, true, 'daily');

-- Insert recurring weekly tasks
INSERT INTO public.growth_tasks (title, description, category, tier, token_reward, xp_reward, difficulty, order_index, is_recurring, reset_frequency) VALUES
('Weekly video upload', 'Upload at least one video this week', 'content', 'basic', 25, 125, 'medium', 201, true, 'weekly'),
('Thumbnail A/B test', 'Test different thumbnails on one video', 'optimization', 'pro', 20, 100, 'medium', 202, true, 'weekly'),
('Competitor analysis', 'Analyze one competitor channel for insights', 'research', 'pro', 15, 75, 'medium', 203, true, 'weekly'),
('Content calendar update', 'Plan your content for the next week', 'planning', 'basic', 15, 75, 'easy', 204, true, 'weekly'),
('SEO optimization', 'Optimize titles/descriptions on 3 older videos', 'seo', 'pro', 20, 100, 'medium', 205, true, 'weekly'),
('Collaboration outreach', 'Reach out to a potential collaborator', 'networking', 'advanced', 30, 150, 'hard', 206, true, 'weekly');