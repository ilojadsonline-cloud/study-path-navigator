import { supabase } from "@/integrations/supabase/client";

// Reaproveita o bucket existente "mapas-mentais" (privado).
// Admins podem inserir/atualizar/remover; usuários autenticados podem ler.
export const EDITAL_MATERIALS_BUCKET = "mapas-mentais";
export const EDITAL_MATERIALS_CONFIG_PATH = "edital/materials-config.json";
export const EDITAL_MATERIALS_UPLOAD_PREFIX = "edital/materials";

export type EditalMaterialMode = "none" | "link" | "pdf" | "lei_seca";

export type EditalMaterialEntry = {
  id: string;
  disciplinaId: string;
  mode: Exclude<EditalMaterialMode, "none">;
  buttonLabel?: string;
  externalUrl?: string;
  fileName?: string;
  storagePath?: string;
  updatedAt: string;
};

export type EditalMaterialsConfig = {
  version: 2;
  updatedAt: string;
  // Cada disciplina pode ter VÁRIOS materiais, listados em ordem.
  materials: Record<string, EditalMaterialEntry[]>;
};

const EMPTY_CONFIG: EditalMaterialsConfig = {
  version: 2,
  updatedAt: new Date(0).toISOString(),
  materials: {},
};

export function generateMaterialId(): string {
  return `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function blobToText(blob: Blob) {
  return await blob.text();
}

// Normaliza entradas legadas (v1: 1 material por disciplina) para arrays (v2).
function normalizeMaterials(raw: any): Record<string, EditalMaterialEntry[]> {
  const result: Record<string, EditalMaterialEntry[]> = {};
  if (!raw || typeof raw !== "object") return result;

  for (const [disciplinaId, value] of Object.entries(raw)) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    const normalized = list
      .filter((entry) => entry && typeof entry === "object")
      .map((entry: any) => ({
        id: typeof entry.id === "string" && entry.id ? entry.id : generateMaterialId(),
        disciplinaId,
        mode: entry.mode,
        buttonLabel: entry.buttonLabel,
        externalUrl: entry.externalUrl,
        fileName: entry.fileName,
        storagePath: entry.storagePath,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
      })) as EditalMaterialEntry[];

    if (normalized.length > 0) {
      result[disciplinaId] = normalized;
    }
  }

  return result;
}

export async function loadEditalMaterialsConfig(): Promise<EditalMaterialsConfig> {
  const { data, error } = await supabase.storage
    .from(EDITAL_MATERIALS_BUCKET)
    .download(`${EDITAL_MATERIALS_CONFIG_PATH}?t=${Date.now()}`);

  if (error || !data) {
    return EMPTY_CONFIG;
  }

  try {
    const raw = await blobToText(data);
    const parsed = JSON.parse(raw) as Partial<EditalMaterialsConfig>;
    return {
      version: 2,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : EMPTY_CONFIG.updatedAt,
      materials: normalizeMaterials(parsed.materials),
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

export async function saveEditalMaterialsConfig(materials: Record<string, EditalMaterialEntry[]>) {
  // Remove disciplinas sem materiais para manter o JSON limpo.
  const cleaned: Record<string, EditalMaterialEntry[]> = {};
  for (const [disciplinaId, list] of Object.entries(materials)) {
    if (Array.isArray(list) && list.length > 0) {
      cleaned[disciplinaId] = list;
    }
  }

  const payload: EditalMaterialsConfig = {
    version: 2,
    updatedAt: new Date().toISOString(),
    materials: cleaned,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const { error } = await supabase.storage
    .from(EDITAL_MATERIALS_BUCKET)
    .upload(EDITAL_MATERIALS_CONFIG_PATH, blob, {
      upsert: true,
      contentType: "application/json",
    });

  if (error) {
    throw error;
  }

  return payload;
}

export async function createEditalMaterialSignedUrl(storagePath: string, expiresInSeconds = 60 * 10) {
  const { data, error } = await supabase.storage
    .from(EDITAL_MATERIALS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Não foi possível gerar a URL do arquivo.");
  }

  return data.signedUrl;
}

export async function removeEditalMaterialFile(storagePath?: string | null) {
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage
    .from(EDITAL_MATERIALS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}
