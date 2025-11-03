-- Add country column to profiles if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

-- No-op if column already exists. Ensure RLS policies still permit the user to update their own row.
