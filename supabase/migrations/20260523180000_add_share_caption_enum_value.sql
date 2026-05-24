-- Add SHARE_CAPTION to ai_task_type enum
-- Required for share caption generation background worker
ALTER TYPE ai_task_type ADD VALUE 'SHARE_CAPTION';
