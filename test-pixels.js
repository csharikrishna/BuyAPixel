import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { count } = await supabase.from('pixels').select('*', { count: 'exact', head: true });
  console.log(`Total pixels in DB: ${count}`);
  
  const { count: availCount } = await supabase.from('pixels').select('*', { count: 'exact', head: true }).is('owner_id', null);
  console.log(`Available pixels in DB: ${availCount}`);
}

check();
