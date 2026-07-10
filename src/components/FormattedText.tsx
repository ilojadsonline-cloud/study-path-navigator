import React from "react";
import { cn } from "@/lib/utils";
import { isHtmlContent, sanitizeRichHtml } from "@/lib/sanitize-html";

// Renderiza texto com formatação leve (markdown-lite), preservando espaços e
// quebras de linha. Ideal para enunciados de Língua Portuguesa que dependem da
// disposição visual (versos, parágrafos, recuos) para a leitura.
//
// Sintaxe suportada (inline):
//   **negrito**      -> <strong>
//   *itálico*        -> <em>
//   __sublinhado__   -> <u>
//   ~~tachado~~      -> <s>
// Espaços e quebras de linha são mantidos via whitespace-pre-wrap.

type Token = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };

const RULES: { re: RegExp; key: keyof Omit<Token, "text"> }[] = [
  { re: /\*\*([\s\S]+?)\*\*/, key: "bold" },
  { re: /__([\s\S]+?)__/, key: "underline" },
  { re: /~~([\s\S]+?)~~/, key: "strike" },
  { re: /\*([\s\S]+?)\*/, key: "italic" },
];

function parseInline(text: string, active: Omit<Token, "text"> = {}): Token[] {
  // Encontra a primeira marcação que aparece no texto.
  let earliest: { index: number; rule: (typeof RULES)[number]; match: RegExpMatchArray } | null = null;
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m && m.index !== undefined && (earliest === null || m.index < earliest.index)) {
      earliest = { index: m.index, rule, match: m };
    }
  }

  if (!earliest) {
    return text ? [{ text, ...active }] : [];
  }

  const { index, rule, match } = earliest;
  const before = text.slice(0, index);
  const inner = match[1];
  const after = text.slice(index + match[0].length);

  return [
    ...(before ? [{ text: before, ...active }] : []),
    ...parseInline(inner, { ...active, [rule.key]: true }),
    ...parseInline(after, active),
  ];
}

// Corrige quebras de linha "soltas" no meio de frases (comuns em textos
// importados que vieram quebrados a ~80 colunas), preservando as quebras
// legítimas: parágrafos (linha em branco) e fim de frase (. ! ? : ;).
function normalizeSoftBreaks(raw: string): string {
  if (!raw) return "";
  // Normaliza CR e reduz 3+ quebras seguidas para separador de parágrafo.
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const lines = text.split("\n");
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out += line;
    if (i === lines.length - 1) break;

    const next = lines[i + 1];
    const prevTrim = line.trimEnd();
    // Linha em branco (parágrafo) ou próxima linha em branco: mantém a quebra.
    if (prevTrim === "" || next.trim() === "") {
      out += "\n";
      continue;
    }
    // Fim de frase: mantém a quebra.
    if (/[.!?:;]$/.test(prevTrim)) {
      out += "\n";
      continue;
    }
    // Início de alternativa/lista/verso na próxima linha: mantém a quebra.
    if (/^\s*([a-eA-E][)\].-]|[IVX]+[)\].-]|[-•*]\s|\d+[)\].-])/.test(next)) {
      out += "\n";
      continue;
    }
    // Caso contrário é quebra "solta" no meio da frase: vira espaço.
    out += prevTrim.endsWith(" ") ? "" : " ";
  }
  return out;
}

interface Props {
  text: string;
  className?: string;
}

export function FormattedText({ text, className }: Props) {
  // Conteúdo criado pelo editor de texto rico é HTML — renderiza sanitizado.
  if (isHtmlContent(text)) {
    return (
      <div
        className={cn("rich-html leading-relaxed", className)}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(text) }}
      />
    );
  }

  const tokens = parseInline(normalizeSoftBreaks(text || ""));

  return (
    <p className={cn("whitespace-pre-wrap leading-relaxed", className)}>
      {tokens.map((t, i) => {
        let node: React.ReactNode = t.text;
        if (t.bold) node = <strong>{node}</strong>;
        if (t.italic) node = <em>{node}</em>;
        if (t.underline) node = <u>{node}</u>;
        if (t.strike) node = <s>{node}</s>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </p>
  );
}

export default FormattedText;
