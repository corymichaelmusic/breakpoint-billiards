const { execSync } = require('child_process');

try {
  console.log("Applying local Supabase migrations...");
  
  // Create migration file
  execSync('mkdir -p supabase/migrations', { stdio: 'inherit' });
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const migrationName = `${timestamp}_add_rule_acknowledgements.sql`;
  
  const fs = require('fs');
  fs.writeFileSync(`supabase/migrations/${migrationName}`, `
-- Add agreement columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bylaws_agreed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bis_rules_agreed boolean DEFAULT false;
  `);
  
  console.log(`Created migration: ${migrationName}`);
  
  // Try pushing using npx supabase db push or linking if not linked
  console.log("Attempting to push to remote Supabase...");
  // Try getting connection string from env
  require('dotenv').config({ path: '.env.local' });
  
  if (process.env.SUPABASE_DB_URL) {
      console.log("Using SUPABASE_DB_URL to push db changes...");
      execSync(`npx supabase db push --db-url "${process.env.SUPABASE_DB_URL}"`, { stdio: 'inherit' });
  } else {
      console.log("No SUPABASE_DB_URL found, trying project ref...");
      execSync(`npx supabase link --project-ref lxyllyfczgxjckqqdxyc -p "${process.env.SUPABASE_DB_PASS || ''}"`, { stdio: 'inherit' });
      execSync(`npx supabase db push`, { stdio: 'inherit' });
  }
  
  console.log("Done!");
} catch (e) {
  console.error("Migration failed:", e.message);
}
