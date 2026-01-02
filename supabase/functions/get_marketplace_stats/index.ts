import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
   'https://buyapixel.onrender.com', // Add your production domains here
   'https://buyapixel.in',
   'http://localhost:5173',
   'http://localhost:8080'
]

function getCorsHeaders(origin: string | null): HeadersInit {
   const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : 'https://buyapixel.in' // specific default or wildcard if safe

   return {
      // Or just use '*' if you don't need credentials
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
   }
}

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
      const supabaseClient = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

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
         const prices = activeListings.map((l) => l.asking_price)
         const total_asking = prices.reduce((a, b) => a + b, 0)

         average_price = Math.round(total_asking / active_listings)
         highest_price = Math.max(...prices)
         lowest_price = Math.min(...prices)
      }

      const stats = {
         active_listings,
         total_sold: totalSold || 0,
         average_price,
         highest_price,
         lowest_price
      }

      return new Response(JSON.stringify(stats), {
         headers: { ...simpleCorsHeaders, 'Content-Type': 'application/json' },
         status: 200,
      })
   } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
         headers: { ...simpleCorsHeaders, 'Content-Type': 'application/json' },
         status: 400,
      })
   }
})
