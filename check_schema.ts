import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkSchema() {
  const { data: cols, error: err } = await supabase
    .rpc('test_or_something') || await supabase.from('tamiz_sessions').select('*'); // Supabase REST doesn't easily expose information_schema to anon.
    
  // Since we can't query information_schema easily via anon key, let's just do an insert and catch the error.
}

checkSchema();
