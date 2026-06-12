
REVOKE EXECUTE ON FUNCTION public.match_knowledge(uuid, vector, int) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.match_knowledge(uuid, vector, int) TO service_role;
