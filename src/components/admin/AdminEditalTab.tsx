import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Clock, ExternalLink, FileDown, Loader2, Save, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { disciplinasLite } from "@/lib/edital-structure";
import {
  EDITAL_MATERIALS_BUCKET,
  EDITAL_MATERIALS_UPLOAD_PREFIX,
  type EditalMaterialEntry,
  type EditalMaterialMode,
  createEditalMaterialSignedUrl,
  loadEditalMaterialsConfig,
  removeEditalMaterialFile,
  saveEditalMaterialsConfig,
} from "@/lib/edital-materials";
import { supabase } from "@/integrations/supabase/client";

type FormState = {
  mode: EditalMaterialMode;
  buttonLabel: string;
  externalUrl: string;
};

const DEFAULT_BUTTON_LABEL = "Material de estudo";

function getInitialForm(entry?: EditalMaterialEntry | null): FormState {
  return {
    mode: entry?.mode ?? "none",
    buttonLabel: entry?.buttonLabel ?? DEFAULT_BUTTON_LABEL,
    externalUrl: entry?.externalUrl ?? "",
  };
}

export default function AdminEditalTab() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Record<string, EditalMaterialEntry>>({});
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      disciplinasLite.map((disc) => ({
        ...disc,
        current: materials[disc.id] ?? null,
        form: forms[disc.id] ?? getInitialForm(materials[disc.id]),
      })),
    [forms, materials],
  );

  const loadConfig = async () => {
    setLoading(true);
    const config = await loadEditalMaterialsConfig();
    setMaterials(config.materials);

    const nextForms: Record<string, FormState> = {};
    disciplinasLite.forEach((disc) => {
      nextForms[disc.id] = getInitialForm(config.materials[disc.id]);
    });
    setForms(nextForms);
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setFormValue = (disciplinaId: string, patch: Partial<FormState>) => {
    setForms((prev) => ({
      ...prev,
      [disciplinaId]: {
        ...(prev[disciplinaId] ?? getInitialForm(materials[disciplinaId])),
        ...patch,
      },
    }));
  };

  const openCurrentMaterial = async (entry: EditalMaterialEntry | null) => {
    try {
      if (!entry) {
        toast.error("Esta disciplina ainda não tem material configurado.");
        return;
      }

      if (entry.mode === "link" && entry.externalUrl) {
        window.open(entry.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (entry.mode === "pdf" && entry.storagePath) {
        const signedUrl = await createEditalMaterialSignedUrl(entry.storagePath);
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível abrir o material.");
    }
  };

  const handleSave = async (disciplinaId: string) => {
    const current = materials[disciplinaId] ?? null;
    const form = forms[disciplinaId] ?? getInitialForm(current);
    const selectedFile = files[disciplinaId];

    setSavingId(disciplinaId);
    try {
      const nextMaterials = { ...materials };

      if (form.mode === "none") {
        if (current?.storagePath) {
          await removeEditalMaterialFile(current.storagePath);
        }
        delete nextMaterials[disciplinaId];
      } else if (form.mode === "link") {
        if (!form.externalUrl.trim()) {
          throw new Error("Informe o link que será usado no botão da disciplina.");
        }
        if (current?.mode === "pdf" && current.storagePath) {
          await removeEditalMaterialFile(current.storagePath);
        }
        nextMaterials[disciplinaId] = {
          disciplinaId,
          mode: "link",
          buttonLabel: form.buttonLabel.trim() || DEFAULT_BUTTON_LABEL,
          externalUrl: form.externalUrl.trim(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        let storagePath = current?.storagePath;
        let fileName = current?.fileName;

        if (selectedFile) {
          if (selectedFile.type !== "application/pdf") {
            throw new Error("O arquivo enviado precisa estar em PDF.");
          }

          const safeName = selectedFile.name.replace(/[^\w.-]+/g, "_");
          const uploadPath = `${EDITAL_MATERIALS_UPLOAD_PREFIX}/${disciplinaId}-${Date.now()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from(EDITAL_MATERIALS_BUCKET)
            .upload(uploadPath, selectedFile, {
              upsert: true,
              contentType: "application/pdf",
            });

          if (uploadError) {
            throw uploadError;
          }

          if (current?.storagePath && current.storagePath !== uploadPath) {
            await removeEditalMaterialFile(current.storagePath);
          }

          storagePath = uploadPath;
          fileName = selectedFile.name;
        }

        if (!storagePath || !fileName) {
          throw new Error("Envie um PDF para salvar o material desta disciplina.");
        }

        nextMaterials[disciplinaId] = {
          disciplinaId,
          mode: "pdf",
          buttonLabel: form.buttonLabel.trim() || DEFAULT_BUTTON_LABEL,
          fileName,
          storagePath,
          updatedAt: new Date().toISOString(),
        };
      }

      await saveEditalMaterialsConfig(nextMaterials);
      setMaterials(nextMaterials);
      setFiles((prev) => ({ ...prev, [disciplinaId]: null }));

      const input = document.getElementById(`edital-file-${disciplinaId}`) as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }

      toast.success("Material do edital atualizado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar o material.");
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async (disciplinaId: string) => {
    const current = materials[disciplinaId];
    if (!current) {
      toast.message("Esta disciplina já está marcada como \"Em breve\".");
      return;
    }

    setRemovingId(disciplinaId);
    try {
      const nextMaterials = { ...materials };
      if (current.storagePath) {
        await removeEditalMaterialFile(current.storagePath);
      }
      delete nextMaterials[disciplinaId];
      await saveEditalMaterialsConfig(nextMaterials);
      setMaterials(nextMaterials);
      setFormValue(disciplinaId, getInitialForm(null));
      setFiles((prev) => ({ ...prev, [disciplinaId]: null }));
      toast.success("Material removido. A disciplina volta a exibir \"Em breve\".");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível remover o material.");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Materiais do Edital</h2>
            <p className="text-sm text-muted-foreground">
              Suba um PDF para download ou informe um link de redirecionamento para cada disciplina.
              Enquanto nada for configurado, a página do Edital exibe a mensagem{" "}
              <span className="font-semibold text-amber-500">"Em breve"</span> no material da disciplina.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((disc) => {
          const current = disc.current;
          const form = disc.form;
          const selectedFile = files[disc.id];
          const isRestricted = Boolean(disc.restricted);

          return (
            <div key={disc.id} className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{disc.title}</h3>
                    {disc.restricted && (
                      <span className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        Sigiloso
                      </span>
                    )}
                    {current?.mode === "pdf" && (
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        PDF para download
                      </span>
                    )}
                    {current?.mode === "link" && (
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        Link externo
                      </span>
                    )}
                    {!current && !disc.restricted && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                        <Clock className="h-3 w-3" />
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{disc.subtitle}</p>
                  {current && (
                    <button
                      type="button"
                      onClick={() => openCurrentMaterial(current)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {current.mode === "pdf" ? <FileDown className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                      Abrir material atual
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  Botão exibido: <span className="font-semibold text-foreground">{form.buttonLabel || DEFAULT_BUTTON_LABEL}</span>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tipo de material</label>
                  <Select
                    value={form.mode}
                    onValueChange={(value) => setFormValue(disc.id, { mode: value as EditalMaterialMode })}
                    disabled={isRestricted}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Em breve (sem material)</SelectItem>
                      <SelectItem value="link">Link de redirecionamento</SelectItem>
                      <SelectItem value="pdf">PDF para download</SelectItem>
                      <SelectItem value="lei_seca">Lei Seca atualizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Texto do botão</label>
                  <Input
                    value={form.buttonLabel}
                    onChange={(e) => setFormValue(disc.id, { buttonLabel: e.target.value })}
                    placeholder={DEFAULT_BUTTON_LABEL}
                    disabled={isRestricted || form.mode === "none"}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Link de redirecionamento</label>
                  <Input
                    value={form.externalUrl}
                    onChange={(e) => setFormValue(disc.id, { externalUrl: e.target.value })}
                    placeholder="https://..."
                    disabled={isRestricted || form.mode !== "link"}
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Arquivo PDF</label>
                  <Input
                    id={`edital-file-${disc.id}`}
                    type="file"
                    accept="application/pdf"
                    disabled={isRestricted || form.mode !== "pdf"}
                    onChange={(e) =>
                      setFiles((prev) => ({
                        ...prev,
                        [disc.id]: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedFile
                      ? `Arquivo selecionado: ${selectedFile.name}`
                      : current?.fileName
                        ? `Arquivo atual: ${current.fileName}`
                        : "Nenhum PDF enviado para esta disciplina."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReset(disc.id)}
                    disabled={isRestricted || removingId === disc.id || savingId === disc.id}
                  >
                    {removingId === disc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remover (Em breve)
                  </Button>
                  <Button onClick={() => handleSave(disc.id)} disabled={isRestricted || savingId === disc.id}>
                    {savingId === disc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : form.mode === "pdf" ? <Upload className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              </div>

              {isRestricted && (
                <p className="text-xs text-destructive">
                  Esta disciplina permanece bloqueada por sigilo institucional (Portaria nº 021/2015-Gab. PMTO)
                  e não aceita material público na plataforma.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
