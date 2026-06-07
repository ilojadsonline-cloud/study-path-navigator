import { supabase } from "@/integrations/supabase/client";

// Reaproveita o bucket existente "mapas-mentais" (privado).
// Admins podem inserir/atualizar/remover; usuários autenticados podem ler.
export const EDITAL_MATERIALS_BUCKET = "mapas-mentais";
export const EDITAL_MATERIALS_CONFIG_PATH = "edital/materials-config.json";
export const EDITAL_MATERIALS_UPLOAD_PREFIX = "edital/materials";

export type EditalMaterialMode = "none" | "link" | "pdf" | "lei_seca";

export type EditalMaterialEntry = {
  disciplinaId: string;
  mode: Exclude<EditalMaterialMode, "none">;
  buttonLabel?: string;
  externalUrl?: string;
  fileName?: string;
  storagePath?: string;
  updatedAt: string;
};

export type EditalMaterialsConfig = {
  version: 1;
  updatedAt: string;
  materials: Record<string, EditalMaterialEntry>;
};

const EMPTY_CONFIG: EditalMaterialsConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  materials: {},
};

async function blobToText(blob: Blob) {
  return await blob.text();
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
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : EMPTY_CONFIG.updatedAt,
      materials: parsed.materials && typeof parsed.materials === "object" ? parsed.materials : {},
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

export async function saveEditalMaterialsConfig(materials: Record<string, EditalMaterialEntry>) {
  const payload: EditalMaterialsConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    materials,
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
