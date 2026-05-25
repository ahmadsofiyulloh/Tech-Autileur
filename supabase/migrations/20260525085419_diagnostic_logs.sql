CREATE TABLE public.diagnostic_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  context text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: owner-only
ALTER TABLE public.diagnostic_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.diagnostic_logs
  FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_diagnostic_logs_user_created
  ON public.diagnostic_logs(user_id, created_at DESC);

CREATE INDEX idx_diagnostic_logs_user_context_level
  ON public.diagnostic_logs(user_id, context, level, created_at DESC);
