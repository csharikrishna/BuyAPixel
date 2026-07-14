-- Create a view that groups purchases by project name (alt_text) rather than just the user profile.
-- This allows the leaderboard to showcase individual brands/projects.
CREATE OR REPLACE VIEW public.vw_project_leaderboard AS
SELECT 
    -- 1) Try alt_text (the name provided during purchase)
    -- 2) Fallback to the buyer's full name
    -- 3) Fallback to 'Anonymous'
    COALESCE(NULLIF(TRIM(px.alt_text), ''), pr.full_name, 'Anonymous') AS project_name,
    
    -- Pick an owner_id to associate with this project (useful for identifying if the current user owns it)
    MAX(px.owner_id::text)::uuid as owner_id,
    
    -- Avatar fallback chain
    MAX(COALESCE(NULLIF(TRIM(px.image_url), ''), pr.avatar_url)) AS avatar_url,
    
    -- Aggregate stats
    COUNT(px.id) AS pixel_count,
    COALESCE(SUM(px.price_paid), 0)::NUMERIC(12,2) AS total_spent
FROM public.pixels px
LEFT JOIN public.profiles pr ON px.owner_id = pr.user_id
WHERE px.owner_id IS NOT NULL
GROUP BY COALESCE(NULLIF(TRIM(px.alt_text), ''), pr.full_name, 'Anonymous');

-- Grant access to public roles so the frontend can query it directly via pg_graphql / PostgREST
GRANT SELECT ON public.vw_project_leaderboard TO anon, authenticated;
