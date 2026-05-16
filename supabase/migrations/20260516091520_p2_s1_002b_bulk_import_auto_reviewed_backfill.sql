update public.product_intake_sessions
set
  reviewed_metadata_json = parsed_metadata_json,
  status = 'REVIEWED'::public.intake_status,
  updated_at = now()
where reviewed_metadata_json is null
  and parsed_metadata_json is not null
  and status in ('DRAFT'::public.intake_status, 'SUBMITTED'::public.intake_status, 'NEEDS_REVIEW'::public.intake_status)
  and (
    parsed_metadata_json ->> 'schema_version' = 'bulk_import_v1'
    or parsed_metadata_json #>> '{source_import,schema_version}' = 'bulk_import_v1'
  );

update public.product_marketplace_sources
set
  status = 'ACTIVE'::public.marketplace_source_status,
  notes = coalesce(nullif(notes, ''), 'Saved from bulk import scraping.'),
  updated_at = now()
where status = 'NEEDS_REVIEW'::public.marketplace_source_status
  and parsed_metadata_json is not null
  and (
    parsed_metadata_json ->> 'schema_version' = 'bulk_import_v1'
    or parsed_metadata_json #>> '{source_import,schema_version}' = 'bulk_import_v1'
  );
