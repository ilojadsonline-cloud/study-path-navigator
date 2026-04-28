-- Bloco 1: Deduplicação semântica reforçada (aditivo, não destrutivo)
-- Adiciona campos para armazenar a "assinatura semântica" (gerada por DeepSeek)
-- e o artigo principal cobrado pela questão, permitindo busca rápida por
-- recorte normativo antes/depois da geração de novas questões.

ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS assinatura_semantica jsonb,
  ADD COLUMN IF NOT EXISTS artigo_principal text;

-- Índice para acelerar a busca por questões que cobrem o mesmo artigo/assunto
CREATE INDEX IF NOT EXISTS idx_questoes_artigo_principal
  ON public.questoes (artigo_principal)
  WHERE artigo_principal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questoes_disciplina_assunto
  ON public.questoes (disciplina, assunto);

-- Índice GIN sobre a assinatura JSONB (para futuras buscas por conceito/pegadinha)
CREATE INDEX IF NOT EXISTS idx_questoes_assinatura_gin
  ON public.questoes USING GIN (assinatura_semantica)
  WHERE assinatura_semantica IS NOT NULL;