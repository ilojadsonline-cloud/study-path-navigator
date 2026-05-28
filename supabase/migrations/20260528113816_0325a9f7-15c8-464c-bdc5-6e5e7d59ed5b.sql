CREATE OR REPLACE FUNCTION public.mark_question_manual_review_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questoes
     SET audit_status = 'manual_review',
         audit_status_updated_at = now()
   WHERE id = NEW.questao_id
     AND audit_status NOT IN ('manual_review', 'admin_resolved', 'deleted');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_question_manual_review_on_report ON public.question_reports;

CREATE TRIGGER trg_mark_question_manual_review_on_report
AFTER INSERT ON public.question_reports
FOR EACH ROW
EXECUTE FUNCTION public.mark_question_manual_review_on_report();