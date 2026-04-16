ALTER TABLE public.team_matches
    ADD COLUMN IF NOT EXISTS is_manually_unlocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.reschedule_requests
    ADD COLUMN IF NOT EXISTS team_match_id uuid REFERENCES public.team_matches(id) ON DELETE CASCADE;

ALTER TABLE public.reschedule_requests
    ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.reschedule_requests
    DROP CONSTRAINT IF EXISTS reschedule_requests_target_check;

ALTER TABLE public.reschedule_requests
    ADD CONSTRAINT reschedule_requests_target_check
    CHECK (num_nonnulls(match_id, team_match_id) = 1);

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_team_match_id
    ON public.reschedule_requests(team_match_id);

DROP POLICY IF EXISTS "Players can insert reschedule requests" ON public.reschedule_requests;
CREATE POLICY "Players can insert reschedule requests"
    ON public.reschedule_requests FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'sub') = requester_id
        AND (
            EXISTS (
                SELECT 1
                FROM public.matches m
                WHERE m.id = reschedule_requests.match_id
                  AND (
                      m.player1_id = (auth.jwt() ->> 'sub')
                      OR m.player2_id = (auth.jwt() ->> 'sub')
                  )
            )
            OR EXISTS (
                SELECT 1
                FROM public.team_matches tm
                LEFT JOIN public.teams ta ON ta.id = tm.team_a_id
                LEFT JOIN public.teams tb ON tb.id = tm.team_b_id
                WHERE tm.id = reschedule_requests.team_match_id
                  AND (
                      ta.captain_id = (auth.jwt() ->> 'sub')
                      OR tb.captain_id = (auth.jwt() ->> 'sub')
                      OR EXISTS (
                          SELECT 1
                          FROM public.team_members tma
                          WHERE tma.team_id = tm.team_a_id
                            AND tma.player_id = (auth.jwt() ->> 'sub')
                      )
                      OR EXISTS (
                          SELECT 1
                          FROM public.team_members tmb
                          WHERE tmb.team_id = tm.team_b_id
                            AND tmb.player_id = (auth.jwt() ->> 'sub')
                      )
                  )
            )
        )
    );

DROP POLICY IF EXISTS "Opponents can update reschedule requests" ON public.reschedule_requests;
CREATE POLICY "Opponents can update reschedule requests"
    ON public.reschedule_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.matches m
            WHERE m.id = reschedule_requests.match_id
              AND (
                  m.player1_id = (auth.jwt() ->> 'sub')
                  OR m.player2_id = (auth.jwt() ->> 'sub')
              )
        )
        OR EXISTS (
            SELECT 1
            FROM public.team_matches tm
            LEFT JOIN public.teams ta ON ta.id = tm.team_a_id
            LEFT JOIN public.teams tb ON tb.id = tm.team_b_id
            WHERE tm.id = reschedule_requests.team_match_id
              AND (
                  ta.captain_id = (auth.jwt() ->> 'sub')
                  OR tb.captain_id = (auth.jwt() ->> 'sub')
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members tma
                      WHERE tma.team_id = tm.team_a_id
                        AND tma.player_id = (auth.jwt() ->> 'sub')
                  )
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members tmb
                      WHERE tmb.team_id = tm.team_b_id
                        AND tmb.player_id = (auth.jwt() ->> 'sub')
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Operators can update reschedule requests" ON public.reschedule_requests;
CREATE POLICY "Operators can update reschedule requests"
    ON public.reschedule_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.matches m
            JOIN public.leagues l ON l.id = m.league_id
            WHERE m.id = reschedule_requests.match_id
              AND l.operator_id = (auth.jwt() ->> 'sub')
        )
        OR EXISTS (
            SELECT 1
            FROM public.team_matches tm
            JOIN public.leagues l ON l.id = tm.league_id
            WHERE tm.id = reschedule_requests.team_match_id
              AND l.operator_id = (auth.jwt() ->> 'sub')
        )
    );
