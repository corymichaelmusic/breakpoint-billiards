-- Add enable_bounty_display to system_settings
INSERT INTO public.system_settings (key, value)
VALUES ('enable_bounty_display', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Ensure it's readable by everyone (The policy "Everyone can read system settings" already exists in update_schema_system_settings.sql)
