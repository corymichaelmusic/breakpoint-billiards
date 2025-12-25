-- Reset 8-Ball set for Match 3cd266ad-ec57-4d0c-864f-72359c495bc4
-- 1. Delete all 8-ball games
DELETE FROM public.games 
WHERE match_id = '3cd266ad-ec57-4d0c-864f-72359c495bc4' 
AND game_type = '8ball';

-- 2. Reset Match Scores and Status
UPDATE public.matches
SET 
    points_8ball_p1 = 0,
    points_8ball_p2 = 0,
    status_8ball = 'not_started',
    winner_id_8ball = NULL,
    status = 'in_progress'
WHERE id = '3cd266ad-ec57-4d0c-864f-72359c495bc4';
