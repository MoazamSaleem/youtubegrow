-- Create badges table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL,
  color text NOT NULL DEFAULT 'primary',
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  requirement_type text NOT NULL DEFAULT 'milestone',
  requirement_value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user badges table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  is_displayed boolean NOT NULL DEFAULT false,
  display_order integer,
  UNIQUE(user_id, badge_id)
);

-- Add display badges to user_tokens for profile
ALTER TABLE public.user_tokens 
ADD COLUMN IF NOT EXISTS displayed_badges uuid[] DEFAULT '{}';

-- Create credits packages table
CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits_amount integer NOT NULL,
  token_cost integer,
  stripe_price_id text,
  price_usd numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  bonus_percentage integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create credits purchase history
CREATE TABLE public.credits_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.credit_packages(id),
  credits_amount integer NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('tokens', 'stripe')),
  tokens_spent integer,
  stripe_payment_id text,
  amount_usd numeric(10,2),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_purchases ENABLE ROW LEVEL SECURITY;

-- Badges policies
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (has_role(auth.uid(), 'admin'));

-- User badges policies
CREATE POLICY "Users can view all user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own badges" ON public.user_badges FOR UPDATE USING (auth.uid() = user_id);

-- Credit packages policies
CREATE POLICY "Anyone can view credit packages" ON public.credit_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage credit packages" ON public.credit_packages FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Credits purchases policies
CREATE POLICY "Users can view their own purchases" ON public.credits_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own purchases" ON public.credits_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default badges linked to milestones
INSERT INTO public.badges (name, description, icon, color, rarity, requirement_type) VALUES
('First Steps', 'Completed your first growth task', 'rocket', 'blue', 'common', 'milestone'),
('Channel Ready', 'Set up your channel fundamentals', 'check-circle', 'green', 'common', 'milestone'),
('Content Creator', 'Started publishing quality content', 'video', 'purple', 'common', 'milestone'),
('Rising Star', 'Building momentum on your channel', 'star', 'yellow', 'rare', 'milestone'),
('Engagement Master', 'Connect deeply with your audience', 'heart', 'pink', 'rare', 'milestone'),
('Growth Expert', 'Mastering YouTube growth strategies', 'trending-up', 'cyan', 'rare', 'milestone'),
('Partner Ready', 'Approaching monetization eligibility', 'dollar-sign', 'green', 'epic', 'milestone'),
('YouTube Pro', 'You''ve become a YouTube professional', 'award', 'orange', 'epic', 'milestone'),
('Legendary Creator', 'Achieved legendary status', 'crown', 'gold', 'legendary', 'milestone'),
('Early Adopter', 'Joined during beta', 'sparkles', 'purple', 'legendary', 'special'),
('Task Master', 'Completed 50 tasks', 'target', 'blue', 'rare', 'tasks'),
('Token Collector', 'Earned 1000 tokens', 'coins', 'yellow', 'rare', 'tokens'),
('Streak Champion', 'Completed daily tasks 7 days in a row', 'flame', 'orange', 'epic', 'streak');

-- Insert credit packages
INSERT INTO public.credit_packages (name, credits_amount, token_cost, price_usd, bonus_percentage) VALUES
('Starter Pack', 500, 100, 2.99, 0),
('Growth Pack', 1500, 250, 7.99, 10),
('Pro Pack', 5000, 750, 19.99, 20),
('Ultimate Pack', 15000, 2000, 49.99, 30);

-- Update milestones to link with badges
UPDATE public.badges b
SET milestone_id = m.id
FROM public.milestones m
WHERE 
  (b.name = 'First Steps' AND m.title = 'Getting Started') OR
  (b.name = 'Channel Ready' AND m.title = 'Channel Ready') OR
  (b.name = 'Content Creator' AND m.title = 'Content Creator') OR
  (b.name = 'Rising Star' AND m.title = 'Rising Star') OR
  (b.name = 'Engagement Master' AND m.title = 'Engagement Master') OR
  (b.name = 'Growth Expert' AND m.title = 'Growth Expert') OR
  (b.name = 'Partner Ready' AND m.title = 'Partner Ready') OR
  (b.name = 'YouTube Pro' AND m.title = 'YouTube Pro') OR
  (b.name = 'Legendary Creator' AND m.title = 'Legendary Creator');