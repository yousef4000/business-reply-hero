
REVOKE EXECUTE ON FUNCTION public.match_successful_replies(uuid, vector, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_reply_feedback(uuid, text, text, text, text, text, vector, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_successful_replies(uuid, vector, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_reply_feedback(uuid, text, text, text, text, text, vector, text[]) TO authenticated, service_role;
