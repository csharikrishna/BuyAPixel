-- Fix the Supabase linter warning: 0010_security_definer_view
-- By default, views in Postgres operate as SECURITY DEFINER (running with the privileges of the creator).
-- We explicitly set it to SECURITY INVOKER so it executes with the privileges of the querying user and respects RLS.
ALTER VIEW public.vw_project_leaderboard SET (security_invoker = true);
