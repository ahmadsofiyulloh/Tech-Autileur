-- PROMPT-SINGLE-GEN-01: single prompt generate settings and output variants.

alter table public.prompt_packs
  add column if not exists angle text not null default 'benefit_focused',
  add column if not exists variant_count integer not null default 1,
  add column if not exists input_params_json jsonb not null default '{}'::jsonb,
  add column if not exists output_variants_json jsonb;

alter table public.prompt_packs
  drop constraint if exists prompt_packs_angle_check,
  add constraint prompt_packs_angle_check
    check (angle in (
      'benefit_focused',
      'problem_solution',
      'social_proof',
      'urgency_scarcity',
      'educational',
      'storytelling'
    ));

alter table public.prompt_packs
  drop constraint if exists prompt_packs_variant_count_check,
  add constraint prompt_packs_variant_count_check
    check (variant_count between 1 and 4);

update public.prompt_packs
set
  angle = coalesce(nullif(angle, ''), 'benefit_focused'),
  variant_count = least(greatest(coalesce(variant_count, 1), 1), 4),
  input_params_json = case
    when input_params_json is null or input_params_json = '{}'::jsonb then
      jsonb_strip_nulls(
        jsonb_build_object(
          'angle', coalesce(nullif(angle, ''), 'benefit_focused'),
          'variant_count', least(greatest(coalesce(variant_count, 1), 1), 4),
          'generation_options', personalization_json -> 'generation_options'
        )
      )
    else input_params_json
  end
where true;

create index if not exists prompt_packs_user_product_created_idx
  on public.prompt_packs (user_id, product_id, created_at desc)
  where status <> 'ARCHIVED';

create index if not exists prompt_packs_user_product_angle_created_idx
  on public.prompt_packs (user_id, product_id, angle, created_at desc)
  where status <> 'ARCHIVED';
