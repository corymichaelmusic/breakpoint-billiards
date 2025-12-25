-- Force recalculate scores for the specific stuck match
UPDATE public.matches m
SET 
    points_8ball_p1 = (SELECT COALESCE(SUM(score_p1), 0) FROM public.games WHERE match_id = m.id AND game_type = '8ball'),
    points_8ball_p2 = (SELECT COALESCE(SUM(score_p2), 0) FROM public.games WHERE match_id = m.id AND game_type = '8ball'),
    points_9ball_p1 = (SELECT COALESCE(SUM(score_p1), 0) FROM public.games WHERE match_id = m.id AND game_type = '9ball'),
    points_9ball_p2 = (SELECT COALESCE(SUM(score_p2), 0) FROM public.games WHERE match_id = m.id AND game_type = '9ball')
    -- We could also attempt to fix status here, but let's just fix points first.
    -- If points < race, status should be in_progress.
WHERE m.id = '3cd266ad-ec57-4d0c-864f-72359c495bc4';

-- Also force status to in_progress if points are below race (to unlock it fully)
UPDATE public.matches
SET status_8ball = 'in_progress', status = 'in_progress', winner_id_8ball = NULL
WHERE id = '3cd266ad-ec57-4d0c-864f-72359c495bc4'
AND points_8ball_p1 < race_8ball_p1 AND points_8ball_p2 < race_8ball_p2;
