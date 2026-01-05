-- Create growth tasks table
CREATE TABLE public.growth_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'advanced')),
  token_reward integer NOT NULL DEFAULT 10,
  xp_reward integer NOT NULL DEFAULT 50,
  difficulty text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index integer NOT NULL DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_days integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create milestones table
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'advanced')),
  required_xp integer NOT NULL,
  token_reward integer NOT NULL DEFAULT 50,
  icon text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user task progress table
CREATE TABLE public.user_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.growth_tasks(id) ON DELETE CASCADE,
  completed_at timestamp with time zone,
  last_completed_at timestamp with time zone,
  completion_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Create user milestones table
CREATE TABLE public.user_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamp with time zone,
  UNIQUE(user_id, milestone_id)
);

-- Create user tokens table
CREATE TABLE public.user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  current_xp integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create perks table
CREATE TABLE public.perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  token_cost integer NOT NULL,
  perk_type text NOT NULL,
  perk_value jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user perks (unlocked perks)
CREATE TABLE public.user_perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perk_id uuid NOT NULL REFERENCES public.perks(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  UNIQUE(user_id, perk_id)
);

-- Enable RLS on all tables
ALTER TABLE public.growth_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;

-- Public read access for tasks, milestones, and perks
CREATE POLICY "Anyone can view growth tasks" ON public.growth_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can view milestones" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Anyone can view perks" ON public.perks FOR SELECT USING (true);

-- User-specific policies for progress tables
CREATE POLICY "Users can view their own task progress" ON public.user_task_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own task progress" ON public.user_task_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own task progress" ON public.user_task_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own milestones" ON public.user_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own milestones" ON public.user_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own milestones" ON public.user_milestones FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens" ON public.user_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tokens" ON public.user_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tokens" ON public.user_tokens FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own perks" ON public.user_perks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own perks" ON public.user_perks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can manage growth tasks" ON public.growth_tasks FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage milestones" ON public.milestones FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage perks" ON public.perks FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all task progress" ON public.user_task_progress FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all user tokens" ON public.user_tokens FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Insert default growth tasks
INSERT INTO public.growth_tasks (title, description, category, tier, token_reward, xp_reward, difficulty, order_index) VALUES
-- Basic tier tasks
('Complete channel setup', 'Add channel description, banner, and profile picture', 'setup', 'basic', 20, 100, 'easy', 1),
('Upload first video', 'Publish your first video to YouTube', 'content', 'basic', 30, 150, 'medium', 2),
('Add channel keywords', 'Research and add relevant keywords to your channel', 'seo', 'basic', 15, 75, 'easy', 3),
('Create channel trailer', 'Make a compelling channel trailer for new visitors', 'content', 'basic', 25, 125, 'medium', 4),
('Set up playlists', 'Organize your videos into at least 3 playlists', 'organization', 'basic', 15, 75, 'easy', 5),
('Optimize video titles', 'Apply SEO best practices to 5 video titles', 'seo', 'basic', 20, 100, 'medium', 6),
('Add end screens', 'Add end screens to promote other videos', 'engagement', 'basic', 15, 75, 'easy', 7),
('Respond to comments', 'Reply to at least 10 viewer comments', 'engagement', 'basic', 10, 50, 'easy', 8),
-- Pro tier tasks
('Reach 100 subscribers', 'Grow your channel to 100 subscribers', 'growth', 'pro', 50, 250, 'medium', 9),
('Publish 10 videos', 'Upload 10 videos to your channel', 'content', 'pro', 40, 200, 'medium', 10),
('Create custom thumbnails', 'Design eye-catching thumbnails for all videos', 'design', 'pro', 30, 150, 'medium', 11),
('Analyze top competitors', 'Study 3 successful channels in your niche', 'research', 'pro', 35, 175, 'medium', 12),
('Establish upload schedule', 'Commit to a consistent posting schedule', 'consistency', 'pro', 25, 125, 'easy', 13),
('Collaborate with creator', 'Partner with another YouTuber on a video', 'networking', 'pro', 50, 250, 'hard', 14),
-- Advanced tier tasks
('Reach 1000 subscribers', 'Hit the first major milestone', 'growth', 'advanced', 100, 500, 'hard', 15),
('Achieve 4000 watch hours', 'Reach monetization threshold', 'growth', 'advanced', 150, 750, 'hard', 16),
('Viral video success', 'Get a video with 10x your average views', 'growth', 'advanced', 100, 500, 'hard', 17),
('Build community tab', 'Regularly engage using Community posts', 'engagement', 'advanced', 40, 200, 'medium', 18),
('Launch merchandise', 'Create and promote channel merchandise', 'monetization', 'advanced', 75, 375, 'hard', 19),
('Host live stream', 'Successfully host a live stream event', 'engagement', 'advanced', 50, 250, 'medium', 20);

-- Insert milestones
INSERT INTO public.milestones (title, description, tier, required_xp, token_reward, icon, order_index) VALUES
('Getting Started', 'Complete your first growth task', 'basic', 50, 25, 'rocket', 1),
('Channel Ready', 'Set up your channel fundamentals', 'basic', 250, 50, 'check-circle', 2),
('Content Creator', 'Start publishing quality content', 'basic', 500, 75, 'video', 3),
('Rising Star', 'Building momentum on your channel', 'pro', 1000, 100, 'star', 4),
('Engagement Master', 'Connect deeply with your audience', 'pro', 1500, 125, 'heart', 5),
('Growth Expert', 'Mastering YouTube growth strategies', 'pro', 2500, 150, 'trending-up', 6),
('Partner Ready', 'Approaching monetization eligibility', 'advanced', 4000, 200, 'dollar-sign', 7),
('YouTube Pro', 'You''ve become a YouTube professional', 'advanced', 6000, 300, 'award', 8),
('Legendary Creator', 'Achieved legendary status', 'advanced', 10000, 500, 'crown', 9);

-- Insert perks
INSERT INTO public.perks (name, description, token_cost, perk_type, perk_value) VALUES
('Extra Keywords', 'Get 20 additional keyword searches per day', 50, 'keywords_boost', '{"amount": 20}'),
('Extra Topics', 'Get 3 additional topic suggestions per day', 75, 'topics_boost', '{"amount": 3}'),
('Priority Support', 'Get priority response from support team', 100, 'support', '{"duration_days": 30}'),
('AI Credits Boost', 'Get 500 bonus AI Strategist credits', 150, 'credits_boost', '{"amount": 500}'),
('Custom Thumbnail Template', 'Unlock exclusive thumbnail templates', 200, 'template', '{"template_id": "premium_1"}'),
('1-on-1 Strategy Session', 'Book a personal strategy consultation', 500, 'consultation', '{"duration_minutes": 30}'),
('Lifetime Badge', 'Display an exclusive profile badge', 1000, 'badge', '{"badge_id": "early_adopter"}');