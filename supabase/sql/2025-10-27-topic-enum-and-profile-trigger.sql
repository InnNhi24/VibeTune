-- Add a CHECK constraint for allowed topics to prevent free-text mistakes
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_topic_chk
CHECK (topic IN ('greeting','travel','food','work','daily_small_talk','general'));

-- Create a function to auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, username, level)
  values (new.id, new.email, split_part(new.email,'@',1), 'Intermediate')
  on conflict (id) do nothing;
  return new;
end; $$;

-- Replace any existing trigger and create the trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
