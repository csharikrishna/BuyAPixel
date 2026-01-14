   -- Create a function to calculate and return user badges
   DROP FUNCTION IF EXISTS get_user_badges(uuid);
   create or replace function get_user_badges(target_user_id uuid)
   returns table (
   badge_id text,
   name text,
   description text,
   icon text,
   earned boolean,
   earned_at timestamptz
   )
   language plpgsql
   security definer
   as $$
   declare
   pixel_count int;
   first_mover_count int;
   diamond_hands_count int;
   total_resale_profit numeric;
   begin
   -- 1. Calculate Landlord Status (Owns > 50 pixels)
   select count(*) into pixel_count from pixels where owner_id = target_user_id;

   -- 2. Calculate First Mover Status (Owns one of the first 100 pixels purchased globally)
   -- We identify the first 100 pixels by purchased_at date
   with first_100 as (
      select id from pixels order by purchased_at asc limit 100
   )
   select count(*) into first_mover_count 
   from pixels p
   join first_100 f on p.id = f.id
   where p.owner_id = target_user_id;

   -- 3. Calculate Diamond Hands Status (Held a pixel for > 30 days)
   select count(*) into diamond_hands_count
   from pixels
   where owner_id = target_user_id
   and purchased_at < (now() - interval '30 days');

   -- 4. Calculate Flipper Status (Profit > 1000 from resales)
   -- Simplified: If user has sold items where sale_price > 0 (assuming they made profit)
   -- Since we don't have a perfect profit history in this simple schema, we'll check total sales volume
   select coalesce(sum(sale_price), 0) into total_resale_profit
   from marketplace_transactions
   where seller_id = target_user_id and status = 'completed';

   return query select * from (
      values 
         (
         'first_mover', 
         'First Mover', 
         'Owned one of the first 100 pixels ever sold', 
         'rocket',
         first_mover_count > 0,
         null::timestamptz
         ),
         (
         'landlord', 
         'Landlord', 
         'Owns more than 50 pixels', 
         'building',
         pixel_count > 50,
         null::timestamptz
         ),
         (
         'diamond_hands', 
         'Diamond Hands', 
         'Held a pixel for over 30 days', 
         'diamond',
         diamond_hands_count > 0,
         null::timestamptz
         ),
         (
         'flipper', 
         'Market Maker', 
         'Generated over ₹1,000 in secondary sales', 
         'dollar-sign',
         total_resale_profit > 1000,
         null::timestamptz
         )
   ) as t(badge_id, name, description, icon, earned, earned_at);
   end;
   $$;
