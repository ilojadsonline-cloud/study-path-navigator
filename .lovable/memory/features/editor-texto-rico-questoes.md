---
name: Editor de Texto Rico em Questões
description: RichTextEditor WYSIWYG (HTML sanitizado) para enunciado/alternativas/comentário na criação manual; render via FormattedText/QuestaoComentario
type: feature
---
## Editor (`src/components/RichTextEditor.tsx`)
- WYSIWYG via `contentEditable` + `document.execCommand`: negrito, itálico, sublinhado, tachado, alinhar esquerda/centro/direita/justificar.
- `allowImage` habilita upload de imagem (só enunciado no form manual). Upload para bucket `questao-imagens` (privado) e gera **URL assinada de 10 anos** (`createSignedUrl`) — bucket público é bloqueado pela policy do workspace e `UPDATE storage.buckets` é proibido.
- Saída é HTML sanitizado por `sanitizeRichHtml`.

## Sanitização (`src/lib/sanitize-html.ts`)
- DOMPurify. Tags: b/strong/i/em/u/s/br/p/div/span/ul/ol/li/img. Attrs: style/src/alt/class. Style allowlist: text-align, font-weight/style, text-decoration, max-width/width/height, margin, display.
- `isHtmlContent(text)` detecta HTML; `htmlToPlainText(html)` p/ validar tamanho.

## Armazenamento
- Campos `enunciado`, `alt_a..alt_e`, `comentario` em `questoes` passam a aceitar HTML (sanitizado no save). Questões antigas (markdown-lite/texto puro) continuam funcionando.

## Renderização
- `FormattedText` (enunciado e alternativas em Questoes/Simulados): se `isHtmlContent` → `dangerouslySetInnerHTML` sanitizado com classe `.rich-html`; senão markdown-lite antigo.
- `QuestaoComentario`: se HTML → render sanitizado; senão parser de seções (formato banca).
- CSS `.rte-editor` (placeholder via :empty::before) e `.rich-html` (img responsiva, listas) em `src/index.css`.

## Form manual (`ManualQuestaoForm.tsx`)
- Substituiu Textarea/FormattingToolbar por `RichTextEditor` em enunciado (com imagem), cada alternativa e comentário. Validação manual via `htmlToPlainText` (removeu zod schema).
