import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requires service role for migrations

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'setup_calendar.sql'), 'utf8');
    
    // Split by semicolons for basic execution, or use a custom RPC if available
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute.`);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      // Warning: Supabase JS client doesn't have a direct 'query' method for raw SQL
      // Typically migrations are run via Supabase CLI or Dashboard.
      // This approach requires a special RPC function setup previously, or we must guide the user to run it.
      
      const { error } = await supabase.rpc('exec_sql', { query: statement });
      if (error) {
          console.error(`Error executing statement:`, error);
          // Don't throw, let it try others (e.g., if table already exists)
      } else {
          console.log(`Success.`);
      }
    }
    
    console.log('Migration attempt finished.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
