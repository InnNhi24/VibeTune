-- Supabase schema for VibeTune (simplified)
-- Run this with `psql` or from Supabase SQL editor

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  created_at timestamptz default now()
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  sender text check (sender in ('user','ai')),
  type text,
  content text,
  audio_url text,
  prosody_feedback jsonb,
  vocab_suggestions jsonb,
  guidance text,
  scores jsonb,
  created_at timestamptz default now(),
  profile_id uuid references users(id) on delete set null
);

-- Feedback (per message)
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Flashcards
create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  word text,
  definition text,
  example text
);

-- Analytics events
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references users(id) on delete cascade,
  event_type text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Example RLS policy for feedback allowing users to access only their feedback
-- Enable RLS on feedback
alter table feedback enable row level security;

create policy "Users can access their own feedback" on feedback
  for all
  using (
    exists (
      select 1 from messages m
      join sessions s on s.id = m.conversation_id
      where m.id = feedback.message_id and s.user_id = auth.uid()
    )
  );

-- Note: adjust policies for sessions/messages/profiles as required by your app.

-- Add foreign key from messages.conversation_id -> sessions.id (if using sessions as conversations)
alter table if exists messages
  add constraint if not exists messages_session_fk
  foreign key (conversation_id) references sessions(id) on delete cascade;
