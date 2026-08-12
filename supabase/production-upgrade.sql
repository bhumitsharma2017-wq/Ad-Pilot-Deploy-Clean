-- Run this once in the Supabase SQL Editor for databases created before the
-- Creative Studio persistence upgrade. It is safe to run more than once.

INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-assets', 'creative-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE INDEX IF NOT EXISTS idx_team_members_member_id
  ON public.team_members(member_id);

DROP POLICY IF EXISTS "Team members can view projects" ON public.projects;
CREATE POLICY "Team members can view projects" ON public.projects
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE owner_id = projects.user_id
        AND member_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );
