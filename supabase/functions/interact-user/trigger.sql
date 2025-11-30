DROP TRIGGER IF EXISTS trg_handle_like_for_match ON public.user_interactions;

CREATE TRIGGER trg_handle_like_for_match
AFTER INSERT OR UPDATE ON public.user_interactions
FOR EACH ROW
EXECUTE FUNCTION handle_like_for_match();
