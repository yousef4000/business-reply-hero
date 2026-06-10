
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plan_monthly_limit(plan_tier) FROM PUBLIC, anon, authenticated;
