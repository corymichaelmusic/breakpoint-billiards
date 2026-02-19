const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.log('URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('Key:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listPlayers() {
  // 1. Get the most recent active session
  const { data: sessions, error: sessionError } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('type', 'session')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessionError) {
    console.error("Error fetching session:", sessionError);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log("No active session found.");
    return;
  }

  const session = sessions[0];
  console.log(`Checking players for Session: ${session.name} (${session.id})`);

  // 2. Get ALL active players for this session
  const { data: players, error } = await supabase
    .from('league_players')
    .select(`
      player_id,
      profiles:player_id(full_name, push_token)
    `)
    .eq('league_id', session.id)
    .eq('status', 'active');

  if (error) {
    console.error("Error fetching players:", error);
    return;
  }

  console.log(`\nFound ${players.length} active players.`);

  let validTokenCount = 0;
  players.forEach((p, index) => {
    // Determine profile object structure
    let profile = p.profiles;
    if (Array.isArray(profile)) {
      profile = profile.length > 0 ? profile[0] : null;
    }

    const hasToken = profile && profile.push_token && profile.push_token.trim().length > 0;
    if (hasToken) validTokenCount++;

    const statusIcon = hasToken ? '✅' : '❌';
    const tokenDisplay = hasToken ? (profile.push_token.substring(0, 15) + '...') : 'No Token';

    console.log(`${index + 1}. ${profile?.full_name || 'Unknown'}: ${statusIcon} ${tokenDisplay}`);
  });

  console.log(`\nSummary: ${validTokenCount} out of ${players.length} players have push tokens.`);
}

listPlayers();
