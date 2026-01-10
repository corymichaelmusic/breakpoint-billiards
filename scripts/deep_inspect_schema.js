const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);
async function run() {
  // List Tables
  const { data: tables, error: tErr } = await supabase.rpc('get_tables'); // Custom RPC? Unlikely to exist.
  // Fallback: just check specific tables we suspect
  const queries = [
    supabase.from('matches').select('*').limit(1),
    supabase.from('player_ratings').select('*').limit(1),
    supabase.from('rating_history').select('*').limit(1),
    supabase.from('ratings_history').select('*').limit(1),
    supabase.from('profiles').select('*').limit(1)
  ];
  
  const results = await Promise.allSettled(queries);
  
  console.log('--- Matches Columns ---');
  if (results[0].status === 'fulfilled' && results[0].value.data) console.log(Object.keys(results[0].value.data[0] || {}));
  
  console.log('--- Player Ratings Table ---');

  console.log('--- Rating History Table ---');

   console.log('--- Ratings History Table ---');
}
run();
