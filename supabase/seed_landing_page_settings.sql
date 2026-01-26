
INSERT INTO public.system_settings (key, value)
VALUES 
  ('landing_page_box_title_line_1', $$MONEY MONDAYS @ FAT'S BILLIARDS$$),
  ('landing_page_box_title_line_2', 'STARTS FEBRUARY 16'),
  ('landing_page_box_text', $$Secure Your Spot Today! 
Download the app, create an account and join the session!$$)
ON CONFLICT (key) DO NOTHING;
