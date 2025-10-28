-- Migration: add personal info columns used by frontend PersonalInfo component
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS native_language text,
  ADD COLUMN IF NOT EXISTS learning_goal text;

-- Optional: create an index on username if you want fast lookups
-- Be careful creating a UNIQUE index if your data may contain duplicates
-- CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);

-- If you do want uniqueness (do this only after ensuring no duplicates):
-- CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);
