-- ───────────── Biblioteca de fontes oficiais (CHOA CBMTO) ─────────────
CREATE TABLE public.cbmto_fontes_oficiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid REFERENCES public.cursos(id),
  arquivo text NOT NULL,
  tipo text NOT NULL DEFAULT 'markdown',
  papel text NOT NULL DEFAULT 'fonte',
  disciplina text,
  versao text NOT NULL DEFAULT '1',
  data_documento date,
  storage_path text,
  hash text,
  conteudo text,
  capitulos_autorizados jsonb NOT NULL DEFAULT '[]'::jsonb,
  capitulos_excluidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  artigos_autorizados jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  observacao text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cbmto_fontes_oficiais TO authenticated;
GRANT ALL ON public.cbmto_fontes_oficiais TO service_role;
ALTER TABLE public.cbmto_fontes_oficiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fontes oficiais CBMTO"
  ON public.cbmto_fontes_oficiais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX cbmto_fontes_arquivo_curso_versao_idx
  ON public.cbmto_fontes_oficiais (arquivo, COALESCE(curso_id, '00000000-0000-0000-0000-000000000000'::uuid), versao);

CREATE TRIGGER cbmto_fontes_set_updated_at
  BEFORE UPDATE ON public.cbmto_fontes_oficiais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────── Questões editoriais (rascunho + auditoria) ─────────────
CREATE TABLE public.cbmto_questoes_editoriais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid REFERENCES public.cursos(id),
  questao_id bigint REFERENCES public.questoes(id),
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'correcao_necessaria',
  demo boolean NOT NULL DEFAULT false,
  disciplina text NOT NULL,
  assunto text,
  enunciado text NOT NULL,
  alt_a text NOT NULL DEFAULT '',
  alt_b text NOT NULL DEFAULT '',
  alt_c text NOT NULL DEFAULT '',
  alt_d text NOT NULL DEFAULT '',
  gabarito integer NOT NULL DEFAULT 0,
  comentario text,
  analise_alternativas text,
  dica_prova text,
  base_normativa text,
  arquivo_fonte text,
  capitulo integer,
  artigo integer,
  dispositivo text,
  subtopico text,
  evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  edital_autorizador text,
  data_vigencia date,
  formato text,
  operacao_cognitiva text,
  hipotese_concorrente text,
  logica_distratores jsonb NOT NULL DEFAULT '{}'::jsonb,
  criterios jsonb NOT NULL DEFAULT '[]'::jsonb,
  pontuacao integer NOT NULL DEFAULT 0,
  relatorio_auditoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  assinatura_ineditismo text,
  lote_id uuid,
  lote_tipo text,
  ordem integer,
  created_by uuid,
  revisado_por uuid,
  revisado_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cbmto_questoes_editoriais TO authenticated;
GRANT ALL ON public.cbmto_questoes_editoriais TO service_role;
ALTER TABLE public.cbmto_questoes_editoriais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam questoes editoriais CBMTO"
  ON public.cbmto_questoes_editoriais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX cbmto_questoes_editoriais_status_idx ON public.cbmto_questoes_editoriais (status);
CREATE INDEX cbmto_questoes_editoriais_lote_idx ON public.cbmto_questoes_editoriais (lote_id);
CREATE INDEX cbmto_questoes_editoriais_disciplina_idx ON public.cbmto_questoes_editoriais (disciplina);

CREATE TRIGGER cbmto_questoes_editoriais_set_updated_at
  BEFORE UPDATE ON public.cbmto_questoes_editoriais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Edição de questão aprovada invalida a aprovação e exige nova auditoria
CREATE OR REPLACE FUNCTION public.cbmto_invalidar_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'aprovada' AND NEW.status = 'aprovada' AND (
       NEW.enunciado IS DISTINCT FROM OLD.enunciado OR
       NEW.alt_a IS DISTINCT FROM OLD.alt_a OR
       NEW.alt_b IS DISTINCT FROM OLD.alt_b OR
       NEW.alt_c IS DISTINCT FROM OLD.alt_c OR
       NEW.alt_d IS DISTINCT FROM OLD.alt_d OR
       NEW.gabarito IS DISTINCT FROM OLD.gabarito OR
       NEW.comentario IS DISTINCT FROM OLD.comentario OR
       NEW.analise_alternativas IS DISTINCT FROM OLD.analise_alternativas OR
       NEW.base_normativa IS DISTINCT FROM OLD.base_normativa
     ) THEN
    NEW.status := 'correcao_necessaria';
    NEW.versao := OLD.versao + 1;
    NEW.aprovado_por := NULL;
    NEW.aprovado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cbmto_questoes_editoriais_invalidar_aprovacao
  BEFORE UPDATE ON public.cbmto_questoes_editoriais
  FOR EACH ROW EXECUTE FUNCTION public.cbmto_invalidar_aprovacao();

-- ───────────── Log de auditoria ─────────────
CREATE TABLE public.cbmto_auditoria_log (
  id bigserial PRIMARY KEY,
  questao_editorial_id uuid NOT NULL REFERENCES public.cbmto_questoes_editoriais(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  camadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  falhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  criterios jsonb NOT NULL DEFAULT '[]'::jsonb,
  pontuacao integer NOT NULL DEFAULT 0,
  status_resultante text NOT NULL,
  correcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  executado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cbmto_auditoria_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cbmto_auditoria_log_id_seq TO authenticated;
GRANT ALL ON public.cbmto_auditoria_log TO service_role;
GRANT ALL ON SEQUENCE public.cbmto_auditoria_log_id_seq TO service_role;
ALTER TABLE public.cbmto_auditoria_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem log de auditoria CBMTO"
  ON public.cbmto_auditoria_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins registram log de auditoria CBMTO"
  ON public.cbmto_auditoria_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));