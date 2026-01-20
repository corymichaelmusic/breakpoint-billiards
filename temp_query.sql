select id, player1_id, player2_id, league_id from matches where status = 'schedulled' or status = 'in_progress' limit 1;
