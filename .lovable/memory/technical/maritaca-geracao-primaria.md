---
name: Maritaca Geração Primária
description: sabia-4/sabiazinho-4 por complexidade + tier Flex (-50%); fallback DeepSeek; sem response_format; auditoria/validação intactas
type: feature
---
Maritaca AI é o gerador PRIMÁRIO de questões (etapa `question_generation` no `_shared/aiRouter.ts`).

## Modelo por complexidade
- **high** (jurídico/normativo — tipo "lei" e "conceitual"/Redação Oficial) → `sabia-4`.
- **medium/low** (interpretação de texto — tipo "texto"/Língua Portuguesa) → `sabiazinho-4` (mais barato).
- Passado via `RunAiOptions.complexity` em cada chamada `runAiStage` de `generate-questions-batch`.
- Envs: `AI_MARITACA_GENERATION_MODEL` (sabia-4), `AI_MARITACA_GENERATION_LIGHT_MODEL` (sabiazinho-4).

## Tier Flex (-50%)
- Maritaca recebe `service_tier: "flex"` no body → 50% de desconto, síncrono, sujeito a fila (até 5 min) ou HTTP 429.
- A tentativa Flex usa timeout curto (`AI_MARITACA_FLEX_TIMEOUT_MS`, default 55s). Se a fila não liberar (429/timeout), reexecuta **no tier padrão (ainda Maritaca)** (motivo `maritaca_flex_unavailable`), só então cai p/ DeepSeek Reasoner (R1) → deepseek-chat → Gemini → OpenRouter.
- Flags: `AI_MARITACA_FLEX_ENABLED` (default true), `AI_MARITACA_SERVICE_TIER` (default "flex").
- Batch API NÃO é usada (é assíncrona/24h, não casa com o fluxo síncrono por lote do admin).

## Outras regras
- Maritaca NÃO suporta `response_format: json_object` → `jsonResponse:false`; JSON garantido por prompt + pipeline de extração/reparo.
- `runAiStage` tem `contentValidator`: se o lote vier vazio/sem questões parseáveis, trata como falha e cai p/ próximo provedor (evita lote "+0").
- Auditoria/validação seguem DeepSeek/Gemini por complexidade (INALTERADAS).
- Remove tags `<think>` do conteúdo.
