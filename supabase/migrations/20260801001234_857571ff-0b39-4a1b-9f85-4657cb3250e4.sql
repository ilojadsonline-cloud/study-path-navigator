-- ============ 1. CATÁLOGO DE CURSOS ============
CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  sigla text NOT NULL,
  descricao text,
  cor text NOT NULL DEFAULT 'gold',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT false,
  visivel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cursos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cursos_select_all" ON public.cursos
  FOR SELECT USING (true);
CREATE POLICY "cursos_admin_manage" ON public.cursos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cursos_updated_at
  BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cursos (slug, nome, sigla, descricao, cor, ordem, ativo, visivel) VALUES
  ('pmto',  'CHOA PMTO',  'PMTO',  'Curso de Habilitação de Oficiais Administrativos — Polícia Militar do Tocantins', 'gold', 1, true,  true),
  ('cbmto', 'CHOA CBMTO', 'CBMTO', 'Curso de Habilitação de Oficiais Administrativos — Corpo de Bombeiros Militar do Tocantins', 'destructive', 2, false, false);

-- Helper estável para default/backfill
CREATE OR REPLACE FUNCTION public.curso_pmto_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT id FROM public.cursos WHERE slug = 'pmto' LIMIT 1 $$;

-- ============ 2. PLANOS COMERCIAIS ============
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco_centavos integer NOT NULL,
  dias_acesso integer NOT NULL DEFAULT 90,
  cursos_slugs text[] NOT NULL DEFAULT '{}',
  recorrente boolean NOT NULL DEFAULT false,
  destaque boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.planos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_select_all" ON public.planos
  FOR SELECT USING (true);
CREATE POLICY "planos_admin_manage" ON public.planos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.planos (slug, nome, descricao, preco_centavos, dias_acesso, cursos_slugs, recorrente, destaque, ordem, ativo) VALUES
  ('pmto-trimestral',  'CHOA PMTO — Trimestral',  'Acesso completo ao CHOA PMTO por 90 dias',  9999,  90, ARRAY['pmto'],          false, false, 1, true),
  ('cbmto-trimestral', 'CHOA CBMTO — Trimestral', 'Acesso completo ao CHOA CBMTO por 90 dias', 9999,  90, ARRAY['cbmto'],         false, false, 2, false),
  ('combo-trimestral', 'Combo PMTO + CBMTO',      'Acesso aos dois cursos por 90 dias',        14999, 90, ARRAY['pmto','cbmto'],  false, true,  3, false);

-- ============ 3. ACESSOS POR CURSO ============
CREATE TABLE public.acessos_curso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  plano_slug text,
  origem text NOT NULL DEFAULT 'migracao',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curso_id)
);

CREATE INDEX idx_acessos_curso_user ON public.acessos_curso(user_id);
CREATE INDEX idx_acessos_curso_curso ON public.acessos_curso(curso_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessos_curso TO authenticated;
GRANT ALL ON public.acessos_curso TO service_role;

ALTER TABLE public.acessos_curso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acessos_curso_select_own" ON public.acessos_curso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "acessos_curso_admin_manage" ON public.acessos_curso
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_acessos_curso_updated_at
  BEFORE UPDATE ON public.acessos_curso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função de checagem (evita recursão em policies futuras)
CREATE OR REPLACE FUNCTION public.has_curso_access(_curso_slug text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.acessos_curso ac
        JOIN public.cursos c ON c.id = ac.curso_id
        WHERE ac.user_id = _user_id
          AND c.slug = _curso_slug
          AND ac.ativo = true
          AND (ac.expires_at IS NULL OR ac.expires_at > now())
      );
$$;

-- ============ 4. COLUNA curso_id NAS TABELAS DE CONTEÚDO/HISTÓRICO ============
ALTER TABLE public.questoes                  ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.simulados                 ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.simulado_progress         ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.simulados_semanais        ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.cronogramas               ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.study_sessions            ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.discipline_legal_texts    ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.mapas_mentais             ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();
ALTER TABLE public.bizuaulas_videos          ADD COLUMN curso_id uuid REFERENCES public.cursos(id) DEFAULT public.curso_pmto_id();

-- Backfill: todo o acervo/histórico atual é PMTO
UPDATE public.questoes               SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.simulados              SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.simulado_progress      SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.simulados_semanais     SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.cronogramas            SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.study_sessions         SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.discipline_legal_texts SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.mapas_mentais          SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;
UPDATE public.bizuaulas_videos       SET curso_id = public.curso_pmto_id() WHERE curso_id IS NULL;

CREATE INDEX idx_questoes_curso ON public.questoes(curso_id);
CREATE INDEX idx_simulados_semanais_curso ON public.simulados_semanais(curso_id);
CREATE INDEX idx_study_sessions_curso ON public.study_sessions(curso_id);

-- ============ 5. MIGRAÇÃO DOS ALUNOS ATUAIS → ACESSO PMTO ============
INSERT INTO public.acessos_curso (user_id, curso_id, plano_slug, origem, starts_at, expires_at, ativo, observacao)
SELECT p.user_id, public.curso_pmto_id(), 'pmto-trimestral', 'migracao', p.created_at, NULL, true,
       'Migração multi-curso: acesso PMTO preservado conforme assinatura vigente'
FROM public.profiles p
ON CONFLICT (user_id, curso_id) DO NOTHING;