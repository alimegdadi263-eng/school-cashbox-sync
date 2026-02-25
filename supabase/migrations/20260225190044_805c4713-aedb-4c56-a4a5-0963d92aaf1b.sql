
-- Add subscription fields to profiles
ALTER TABLE public.profiles
ADD COLUMN is_active boolean NOT NULL DEFAULT true,
ADD COLUMN subscription_expires_at timestamp with time zone DEFAULT NULL;

-- Allow admins to update any profile's subscription status
-- (existing policies already cover admin ALL access)
