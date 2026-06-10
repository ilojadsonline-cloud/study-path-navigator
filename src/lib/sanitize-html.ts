import DOMPurify from "dompurify";

// Configuração de sanitização para o conteúdo rico das questões
// (enunciado, alternativas e comentários). Permite apenas formatação
// segura: negrito, itálico, sublinhado, alinhamento de parágrafo,
// quebras de linha, listas e imagens hospedadas no storage.
const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "br",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "img",
];

const ALLOWED_ATTR = ["style", "src", "alt", "class"];

// Apenas estilos relacionados a alinhamento, ênfase de texto e dimensão de imagem.
const SAFE_STYLE_RE =
  /^(text-align|font-weight|font-style|text-decoration|max-width|width|height|margin|display)\s*:/i;

let configured = false;
function ensureConfig() {
  if (configured) return;
  configured = true;
  // Remove qualquer style não previsto na allowlist após a sanitização básica.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (el.hasAttribute && el.hasAttribute("style")) {
      const raw = el.getAttribute("style") || "";
      const safe = raw
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && SAFE_STYLE_RE.test(s))
        .join("; ");
      if (safe) el.setAttribute("style", safe);
      else el.removeAttribute("style");
    }
    // Garante que imagens não estourem o layout.
    if (el.tagName === "IMG") {
      const prev = el.getAttribute("style") || "";
      if (!/max-width/i.test(prev)) {
        el.setAttribute("style", `${prev}${prev ? "; " : ""}max-width: 100%; height: auto`);
      }
      el.setAttribute("loading", "lazy");
    }
  });
}

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  ensureConfig();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i,
  });
}

// Detecta se um conteúdo contém marcação HTML (gerado pelo editor de texto rico).
export function isHtmlContent(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text || "");
}

// Extrai o texto puro de um conteúdo HTML (para validação de tamanho).
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = sanitizeRichHtml(html);
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}
