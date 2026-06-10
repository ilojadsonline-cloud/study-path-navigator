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

interface Props {
  text: string;
  className?: string;
}

export function FormattedText({ text, className }: Props) {
  const tokens = parseInline(text || "");

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
