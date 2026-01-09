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

      // 1. Get active listings stats
      const { data: activeListings, error: listingsError } = await supabaseClient
         .from('marketplace_listings')
         .select('asking_price')
         .eq('status', 'active')

      if (listingsError) throw listingsError

      // 2. Get total sold count
      const { count: totalSold, error: soldError } = await supabaseClient
         .from('marketplace_transactions')
         .select('*', { count: 'exact', head: true })

      if (soldError) throw soldError

      // Calculate stats from active listings
      let average_price = 0
      let highest_price = 0
      let lowest_price = 0
      const active_listings = activeListings?.length || 0

      if (active_listings > 0) {
         // deno-lint-ignore no-explicit-any
         const listings = activeListings as any[]
         const prices = listings.map((l: { asking_price: number }) => l.asking_price)
         const total_asking = prices.reduce((a: number, b: number) => a + b, 0)

         average_price = Math.round(total_asking / active_listings)
         highest_price = Math.max(...prices)
         lowest_price = Math.min(...prices)
      }

      const stats = {
         active_listings,
         total_sold: totalSold || 0,
         average_price,
         highest_price,
         lowest_price,
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
