begin;

alter table public.generated_files
  add column if not exists stage text not null default 'VIDEO',
  add column if not exists helper_report_json jsonb;

alter table public.generated_files
  drop constraint if exists generated_files_stage_check;

alter table public.generated_files
  add constraint generated_files_stage_check
  check (stage in ('FIRST_FRAME', 'LAST_FRAME', 'VIDEO'));

create index if not exists generated_files_user_stage_idx
  on public.generated_files (user_id, stage);

create index if not exists generated_files_user_clip_job_stage_idx
  on public.generated_files (user_id, clip_job_id, stage);

commit;
