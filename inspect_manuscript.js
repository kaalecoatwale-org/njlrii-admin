const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tsznkjdlnnewpnumeqkx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzem5ramRsbm5ld3BudW1lcWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4ODA0MSwiZXhwIjoyMDkxNTY0MDQxfQ._D7yugHCmfGxbXelhC0SaaAYITHt-jrLitrbGJQ_coU';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function inspect() {
  const { data, error } = await supabase.from('manuscripts').select('*').limit(1);
  if (error) {
    console.error('Error fetching manuscript:', error);
  } else {
    console.log('Manuscript columns:', Object.keys(data[0] || {}));
  }
}

inspect();
