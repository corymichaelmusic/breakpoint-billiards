-- Add minimum version and store URLs to system_settings

insert into public.system_settings (key, value)
values 
  ('minimum_mobile_version', '1.0.0'),
  ('ios_store_url', 'https://apps.apple.com/us/app/breakpoint-billiards/id6479730421'), 
  ('android_store_url', 'https://play.google.com/store/apps/details?id=com.corymichael.breakpointbilliards')
on conflict (key) do nothing;
