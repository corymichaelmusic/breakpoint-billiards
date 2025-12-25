-- Manually correct the winner for 8-ball set of match 3cd266ad-ec57-4d0c-864f-72359c495bc4
-- Player 2 (Sim Player 36) should be the winner because they won the last game (Game 4).
UPDATE public.matches
SET winner_id_8ball = (SELECT player2_id FROM public.matches WHERE id = '3cd266ad-ec57-4d0c-864f-72359c495bc4')
WHERE id = '3cd266ad-ec57-4d0c-864f-72359c495bc4';
