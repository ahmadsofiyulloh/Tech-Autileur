alter table public.flow_batches
  add column if not exists flow_url text,
  add column if not exists helper_output_folder_key text,
  add column if not exists manifest_json jsonb,
  add column if not exists last_helper_event_at timestamptz;
