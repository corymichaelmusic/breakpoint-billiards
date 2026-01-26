
INSERT INTO public.system_settings (key, value)
VALUES 
  ('landing_page_box_location', 'Fort Worth, TX')
ON CONFLICT (key) DO NOTHING;
