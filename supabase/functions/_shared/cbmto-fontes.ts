// Recuperação de trechos das fontes locais autorizadas — CHOA CBMTO 2026.
// Nunca envia ao modelo capítulo excluído nem mistura disciplinas diferentes.

import { EscopoDisciplina } from "./escopo-cbmto.ts";

const CAP_REGEX =
  /^\s*#{0,6}\s*(?:CAP[ÍI]TULO|CAP\.|M[ÓO]DULO|UNIDADE)\s+([0-9]{1,2}|[IVXLC]+)\b.*$/gim;

const ROMANOS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23,
};

function numeroCapitulo(token: string): number | null {
  const t = token.trim().toUpperCase();
  if (/^\d+$/.test(t)) return Number(t);
  return ROMANOS[t] ?? null;
}

export interface Trecho {
  capitulo: number | null;
  titulo: string;
  texto: string;
}

/** Divide o markdown em capítulos/módulos. Sem marcações → um único trecho. */
export function dividirPorCapitulo(conteudo: string): Trecho[] {
  const marcas: { idx: number; cap: number | null; titulo: string }[] = [];
  CAP_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CAP_REGEX.exec(conteudo)) !== null) {
    marcas.push({ idx: m.index, cap: numeroCapitulo(m[1]), titulo: m[0].trim() });
  }
  if (marcas.length === 0) return [{ capitulo: null, titulo: "Documento integral", texto: conteudo }];

  const out: Trecho[] = [];
  if (marcas[0].idx > 0) {
    out.push({ capitulo: null, titulo: "Preâmbulo", texto: conteudo.slice(0, marcas[0].idx) });
  }
  marcas.forEach((mk, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].idx : conteudo.length;
    out.push({ capitulo: mk.cap, titulo: mk.titulo, texto: conteudo.slice(mk.idx, fim) });
  });
  return out;
}

/** Divide por artigos (usado em CPM/CPPM e leis). */
export function dividirPorArtigo(conteudo: string): { artigo: number | null; texto: string }[] {
  const re = /^\s*Art(?:igo)?\.?\s*(\d{1,4})/gim;
  const marcas: { idx: number; art: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo)) !== null) marcas.push({ idx: m.index, art: Number(m[1]) });
  if (marcas.length === 0) return [{ artigo: null, texto: conteudo }];
  return marcas.map((mk, i) => ({
    artigo: mk.art,
    texto: conteudo.slice(mk.idx, i + 1 < marcas.length ? marcas[i + 1].idx : conteudo.length),
  }));
}

export interface FiltroTrechos {
  capitulo?: number | null;
  artigo?: number | null;
  maxChars?: number;
  seed?: number;
}

/**
 * Retorna apenas o texto autorizado pelo edital para a disciplina.
 * Capítulos excluídos e artigos fora das faixas nunca entram no contexto.
 */
export function recuperarTrechosAutorizados(
  conteudo: string,
  escopo: EscopoDisciplina,
  filtro: FiltroTrechos = {},
): { texto: string; capitulosUsados: number[]; artigosUsados: number[] } {
  const maxChars = filtro.maxChars ?? 14000;
  const capitulosUsados: number[] = [];
  const artigosUsados: number[] = [];

  let base = conteudo;

  if (escopo.capitulosAutorizados.length > 0 || escopo.capitulosExcluidos.length > 0) {
    const trechos = dividirPorCapitulo(conteudo).filter((t) => {
      if (t.capitulo === null) return escopo.capitulosAutorizados.length === 0;
      if (escopo.capitulosExcluidos.includes(t.capitulo)) return false;
      if (escopo.capitulosAutorizados.length && !escopo.capitulosAutorizados.includes(t.capitulo)) return false;
      if (filtro.capitulo != null && t.capitulo !== filtro.capitulo) return false;
      return true;
    });
    trechos.forEach((t) => t.capitulo != null && capitulosUsados.push(t.capitulo));
    base = trechos.map((t) => t.texto).join("\n\n");
  }

  if (escopo.artigosAutorizados.length > 0) {
    const blocos = dividirPorArtigo(base).filter((b) => {
      if (b.artigo === null) return false;
      if (filtro.artigo != null && b.artigo !== filtro.artigo) return false;
      return escopo.artigosAutorizados.some((f) => b.artigo! >= f.de && b.artigo! <= f.ate);
    });
    blocos.forEach((b) => b.artigo != null && artigosUsados.push(b.artigo));
    base = blocos.map((b) => b.texto).join("\n");
  }

  base = base.trim();
  if (base.length > maxChars) {
    // Janela deslocada por seed para variar o recorte entre lotes (sem sair do autorizado)
    const janelas = Math.max(1, Math.ceil(base.length / maxChars));
    const inicio = ((filtro.seed ?? 0) % janelas) * maxChars;
    base = base.slice(inicio, inicio + maxChars);
  }

  return { texto: base, capitulosUsados, artigosUsados };
}
