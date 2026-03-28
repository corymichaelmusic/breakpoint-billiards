require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_PLAYER_ID = 'user_39iAJ8txsuvlSSycKzf7s3PGA0J'; // Jared Mitchell
const LEAGUE_ID = '2b08d033-f2cd-47cc-b6d8-78544a5df684';  // Spring 2026

async function main() {
    // 1. Add notes column if it doesn't exist
    console.log('Adding notes column to matches table...');
    const { error: alterErr } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS notes text;`
    });

    // If rpc doesn't exist, we'll do it manually - but let's try the direct approach
    // The service role key should allow this via the REST API
    // Actually, let's just use the Supabase client to update the rows directly
    // and check if the column exists first

    // 2. Find the inherited matches (finalized matches where Jared is listed but were originally Carson's)
    // These are weeks 1-5 which were played before the swap
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, week_number, status_8ball, status_9ball')
        .eq('league_id', LEAGUE_ID)
        .or(`player1_id.eq.${NEW_PLAYER_ID},player2_id.eq.${NEW_PLAYER_ID}`)
        .in('week_number', [1, 2, 3, 4, 5])
        .or('status_8ball.eq.finalized,status_9ball.eq.finalized');

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    console.log(`Found ${matches.length} inherited matches to label\n`);

    // 3. Tag each match
    for (const match of matches) {
        const { error: updateErr } = await supabase
            .from('matches')
            .update({ notes: 'Originally played by Carson Mills (inherited by Jared Mitchell on 2026-03-23)' })
            .eq('id', match.id);

        if (updateErr) {
            if (updateErr.message?.includes('column') || updateErr.code === '42703') {
                console.error('❌ The "notes" column does not exist. Run this SQL in Supabase first:');
                console.error('   ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS notes text;');
                return;
            }
            console.error(`❌ Week ${match.week_number}:`, updateErr);
        } else {
            console.log(`✅ Week ${match.week_number} (${match.id}): Labeled as inherited from Carson`);
        }
    }

    console.log('\n🎉 Done! Matches are labeled without any UI impact.');
}

main().catch(console.error);
