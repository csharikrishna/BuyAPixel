import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as supabaseJs2 from 'https://esm.sh/@supabase/supabase-js@2'

const simpleCorsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
   // Simple robust CORS
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: simpleCorsHeaders })
   }

   try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !supabaseKey) {
         throw new Error('Missing Supabase environment variables')
      }

      const supabaseClient = supabaseJs2.createClient(supabaseUrl, supabaseKey)

      // Call the DB RPC function directly for optimized stats
      const { data, error } = await supabaseClient.rpc('get_marketplace_stats')

      if (error) throw error

      // Map DB fields (snake_case from RPC) to Edge Function response API (expected by frontend)
      // FIX #6: Add defensive fallbacks in case RPC returns unexpected shape
      const stats = {
         active_listings: data?.active_listings ?? 0,
         total_sold: data?.total_sold ?? 0,
         average_price: data?.avg_price ?? 0,   // RPC returns avg_price
         highest_price: data?.max_price ?? 0,    // RPC returns max_price
         lowest_price: data?.min_price ?? 0,     // RPC returns min_price
      }

      return new Response(JSON.stringify(stats), {
         headers: { ...simpleCorsHeaders, 'Content-Type': 'application/json' },
         status: 200,
      })
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), {
         headers: { ...simpleCorsHeaders, 'Content-Type': 'application/json' },
         status: 400,
      })
   }
})
