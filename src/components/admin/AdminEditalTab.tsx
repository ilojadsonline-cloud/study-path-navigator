import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Clock,
  ExternalLink,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Save,
  Scroll,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDisciplinasLite, ANALISE_EDITAL_DISC } from "@/lib/edital-structure";
import { useCurso } from "@/contexts/CursoContext";

// Inclui o tópico especial "Análise do Edital" (em primeiro) junto das disciplinas.
const getEditalAdminItems = (cursoSlug?: string | null) => [ANALISE_EDITAL_DISC, ...getDisciplinasLite(cursoSlug)];
import {
  EDITAL_MATERIALS_BUCKET,
  EDITAL_MATERIALS_UPLOAD_PREFIX,
  type EditalMaterialEntry,
  type EditalMaterialMode,
  createEditalMaterialSignedUrl,
  generateMaterialId,
  loadEditalMaterialsConfig,
  removeEditalMaterialFile,
  saveEditalMaterialsConfig,
} from "@/lib/edital-materials";
import { supabase } from "@/integrations/supabase/client";

type AddMode = Exclude<EditalMaterialMode, "none">;

type FormState = {
  mode: AddMode;
  buttonLabel: string;
  externalUrl: string;
};

const DEFAULT_BUTTON_LABEL = "Material de estudo";

const MODE_LABEL: Record<AddMode, string> = {
  link: "Link / vídeo",
  pdf: "PDF para download",
  lei_seca: "Lei Seca atualizada",
};

function emptyForm(): FormState {
  return { mode: "link", buttonLabel: "", externalUrl: "" };
}

function formFromEntry(entry: EditalMaterialEntry): FormState {
  return {
    mode: entry.mode,
    buttonLabel: entry.buttonLabel ?? "",
    externalUrl: entry.externalUrl ?? "",
  };
}

async function uploadPdf(disciplinaId: string, file: File) {
  if (file.type !== "application/pdf") {
    throw new Error("O arquivo enviado precisa estar em PDF.");
  }
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const uploadPath = `${EDITAL_MATERIALS_UPLOAD_PREFIX}/${disciplinaId}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(EDITAL_MATERIALS_BUCKET)
    .upload(uploadPath, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  return { storagePath: uploadPath, fileName: file.name };
}

export default function AdminEditalTab() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Record<string, EditalMaterialEntry[]>>({});

  // Formulário "novo material" por disciplina
  const [newForms, setNewForms] = useState<Record<string, FormState>>({});
  const [newFiles, setNewFiles] = useState<Record<string, File | null>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Edição inline de um material existente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      editalAdminItems.map((disc) => ({
        ...disc,
        list: materials[disc.id] ?? [],
        newForm: newForms[disc.id] ?? emptyForm(),
      })),
    [materials, newForms],
  );

  const loadConfig = async () => {
    setLoading(true);
    const config = await loadEditalMaterialsConfig();
    setMaterials(config.materials);
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setNewFormValue = (disciplinaId: string, patch: Partial<FormState>) => {
    setNewForms((prev) => ({
      ...prev,
      [disciplinaId]: { ...(prev[disciplinaId] ?? emptyForm()), ...patch },
    }));
  };

  const openMaterial = async (entry: EditalMaterialEntry) => {
    try {
      if (entry.storagePath) {
        const signedUrl = await createEditalMaterialSignedUrl(entry.storagePath);
        window.open(signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (entry.externalUrl) {
        window.open(entry.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("Este material não tem link ou arquivo configurado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível abrir o material.");
    }
  };

  const persist = async (next: Record<string, EditalMaterialEntry[]>) => {
    await saveEditalMaterialsConfig(next);
    setMaterials(next);
  };

  const handleAdd = async (disciplinaId: string) => {
    const form = newForms[disciplinaId] ?? emptyForm();
    const file = newFiles[disciplinaId] ?? null;

    setAddingId(disciplinaId);
    try {
      const entry: EditalMaterialEntry = {
        id: generateMaterialId(),
        disciplinaId,
        mode: form.mode,
        buttonLabel: form.buttonLabel.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      if (form.mode === "link") {
        if (!form.externalUrl.trim()) throw new Error("Informe o link (página, vídeo ou PDF externo).");
        entry.externalUrl = form.externalUrl.trim();
      } else if (form.mode === "lei_seca") {
        const hasLink = form.externalUrl.trim().length > 0;
        if (!hasLink && !file) throw new Error("Informe um link ou envie um PDF para a Lei Seca.");
        if (file) {
          const up = await uploadPdf(disciplinaId, file);
          entry.storagePath = up.storagePath;
          entry.fileName = up.fileName;
        }
        if (hasLink) entry.externalUrl = form.externalUrl.trim();
      } else {
        if (!file) throw new Error("Envie um arquivo PDF para este material.");
        const up = await uploadPdf(disciplinaId, file);
        entry.storagePath = up.storagePath;
        entry.fileName = up.fileName;
      }

      const next = { ...materials, [disciplinaId]: [...(materials[disciplinaId] ?? []), entry] };
      await persist(next);

      setNewForms((prev) => ({ ...prev, [disciplinaId]: emptyForm() }));
      setNewFiles((prev) => ({ ...prev, [disciplinaId]: null }));
      const input = document.getElementById(`edital-new-file-${disciplinaId}`) as HTMLInputElement | null;
      if (input) input.value = "";

      toast.success("Material adicionado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível adicionar o material.");
    } finally {
      setAddingId(null);
    }
  };

  const startEdit = (entry: EditalMaterialEntry) => {
    setEditingId(entry.id);
    setEditForm(formFromEntry(entry));
    setEditFile(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFile(null);
  };

  const saveEdit = async (entry: EditalMaterialEntry) => {
    setSavingId(entry.id);
    try {
      const updated: EditalMaterialEntry = {
        ...entry,
        mode: editForm.mode,
        buttonLabel: editForm.buttonLabel.trim() || undefined,
        externalUrl: undefined,
        updatedAt: new Date().toISOString(),
      };

      if (editForm.mode === "link") {
        if (!editForm.externalUrl.trim()) throw new Error("Informe o link.");
        updated.externalUrl = editForm.externalUrl.trim();
        if (entry.storagePath) {
          await removeEditalMaterialFile(entry.storagePath);
          updated.storagePath = undefined;
          updated.fileName = undefined;
        }
      } else if (editForm.mode === "lei_seca") {
        const hasLink = editForm.externalUrl.trim().length > 0;
        if (editFile) {
          const up = await uploadPdf(entry.disciplinaId, editFile);
          if (entry.storagePath && entry.storagePath !== up.storagePath) {
            await removeEditalMaterialFile(entry.storagePath);
          }
          updated.storagePath = up.storagePath;
          updated.fileName = up.fileName;
        }
        if (hasLink) updated.externalUrl = editForm.externalUrl.trim();
        if (!hasLink && !editFile && !entry.storagePath) {
          throw new Error("Informe um link ou envie um PDF para a Lei Seca.");
        }
      } else {
        if (editFile) {
          const up = await uploadPdf(entry.disciplinaId, editFile);
          if (entry.storagePath && entry.storagePath !== up.storagePath) {
            await removeEditalMaterialFile(entry.storagePath);
          }
          updated.storagePath = up.storagePath;
          updated.fileName = up.fileName;
        }
        if (!updated.storagePath) throw new Error("Envie um PDF para este material.");
      }

      const next = {
        ...materials,
        [entry.disciplinaId]: (materials[entry.disciplinaId] ?? []).map((m) =>
          m.id === entry.id ? updated : m,
        ),
      };
      await persist(next);
      setEditingId(null);
      setEditFile(null);
      toast.success("Material atualizado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar o material.");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (entry: EditalMaterialEntry) => {
    if (!confirm(`Remover "${entry.buttonLabel || DEFAULT_BUTTON_LABEL}"?`)) return;
    setRemovingId(entry.id);
    try {
      if (entry.storagePath) {
        await removeEditalMaterialFile(entry.storagePath);
      }
      const remaining = (materials[entry.disciplinaId] ?? []).filter((m) => m.id !== entry.id);
      const next = { ...materials };
      if (remaining.length > 0) next[entry.disciplinaId] = remaining;
      else delete next[entry.disciplinaId];
      await persist(next);
      toast.success("Material removido.");
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
              Adicione quantos materiais quiser por disciplina (links, vídeos, PDFs e Lei Seca). Cada
              novo material entra na lista <span className="font-semibold text-foreground">sem substituir</span> os
              demais, e você pode editar, remover ou reenviar individualmente. Materiais do tipo{" "}
              <span className="font-semibold text-amber-500">Lei Seca</span> substituem o link de lei seca exibido na
              página do Edital.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((disc) => {
          const isRestricted = Boolean(disc.restricted);
          const list = disc.list;
          const form = disc.newForm;
          const newFile = newFiles[disc.id] ?? null;

          return (
            <div key={disc.id} className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{disc.title}</h3>
                {disc.restricted && (
                  <span className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                    Sigiloso
                  </span>
                )}
                {!isRestricted && (
                  <span className="rounded-full border border-border/40 bg-secondary/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {list.length} material{list.length === 1 ? "" : "is"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground -mt-2">{disc.subtitle}</p>

              {isRestricted ? (
                <p className="text-xs text-destructive">
                  Esta disciplina permanece bloqueada por sigilo institucional (Portaria nº 021/2015-Gab. PMTO)
                  e não aceita material público na plataforma.
                </p>
              ) : (
                <>
                  {/* Lista de materiais cadastrados */}
                  {list.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-500">
                      <Clock className="h-3.5 w-3.5" />
                      Nenhum material ainda — a página do Edital exibe "Em breve".
                    </div>
                  ) : (
                    <ol className="space-y-2">
                      {list.map((entry, idx) => {
                        const isEditing = editingId === entry.id;
                        return (
                          <li
                            key={entry.id}
                            className="rounded-xl border border-border/40 bg-secondary/20 p-3"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                                    <Select
                                      value={editForm.mode}
                                      onValueChange={(value) =>
                                        setEditForm((p) => ({ ...p, mode: value as AddMode }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="link">{MODE_LABEL.link}</SelectItem>
                                        <SelectItem value="pdf">{MODE_LABEL.pdf}</SelectItem>
                                        <SelectItem value="lei_seca">{MODE_LABEL.lei_seca}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Título do material</label>
                                    <Input
                                      value={editForm.buttonLabel}
                                      onChange={(e) => setEditForm((p) => ({ ...p, buttonLabel: e.target.value }))}
                                      placeholder={DEFAULT_BUTTON_LABEL}
                                    />
                                  </div>
                                </div>
                                {(editForm.mode === "link" || editForm.mode === "lei_seca") && (
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Link</label>
                                    <Input
                                      value={editForm.externalUrl}
                                      onChange={(e) => setEditForm((p) => ({ ...p, externalUrl: e.target.value }))}
                                      placeholder="https://..."
                                    />
                                  </div>
                                )}
                                {(editForm.mode === "pdf" || editForm.mode === "lei_seca") && (
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                      {editForm.mode === "lei_seca" ? "PDF da Lei Seca (opcional)" : "Arquivo PDF"}
                                    </label>
                                    <Input
                                      type="file"
                                      accept="application/pdf"
                                      onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {editFile
                                        ? `Novo arquivo: ${editFile.name}`
                                        : entry.fileName
                                          ? `Arquivo atual: ${entry.fileName}`
                                          : "Nenhum PDF enviado."}
                                    </p>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" onClick={() => saveEdit(entry)} disabled={savingId === entry.id}>
                                    {savingId === entry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                    Salvar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                    <X className="h-4 w-4" /> Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openMaterial(entry)}
                                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary hover:underline"
                                    >
                                      {entry.mode === "lei_seca" ? (
                                        <Scroll className="h-3.5 w-3.5" />
                                      ) : entry.storagePath ? (
                                        <FileDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      )}
                                      {entry.buttonLabel || DEFAULT_BUTTON_LABEL}
                                    </button>
                                    <span className="rounded-full border border-border/40 bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {MODE_LABEL[entry.mode]}
                                    </span>
                                  </div>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {entry.fileName || entry.externalUrl || "—"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button size="sm" variant="outline" onClick={() => startEdit(entry)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={removingId === entry.id}
                                    onClick={() => handleRemove(entry)}
                                  >
                                    {removingId === entry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {/* Formulário de novo material */}
                  <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Adicionar material
                    </p>
                    <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                        <Select
                          value={form.mode}
                          onValueChange={(value) => setNewFormValue(disc.id, { mode: value as AddMode })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="link">{MODE_LABEL.link}</SelectItem>
                            <SelectItem value="pdf">{MODE_LABEL.pdf}</SelectItem>
                            <SelectItem value="lei_seca">{MODE_LABEL.lei_seca}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Título do material</label>
                        <Input
                          value={form.buttonLabel}
                          onChange={(e) => setNewFormValue(disc.id, { buttonLabel: e.target.value })}
                          placeholder={DEFAULT_BUTTON_LABEL}
                        />
                      </div>
                    </div>

                    {(form.mode === "link" || form.mode === "lei_seca") && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          {form.mode === "lei_seca" ? "Link da Lei Seca (opcional se enviar PDF)" : "Link (página, vídeo ou PDF externo)"}
                        </label>
                        <Input
                          value={form.externalUrl}
                          onChange={(e) => setNewFormValue(disc.id, { externalUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    )}

                    {(form.mode === "pdf" || form.mode === "lei_seca") && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          {form.mode === "lei_seca" ? "PDF da Lei Seca (opcional)" : "Arquivo PDF"}
                        </label>
                        <Input
                          id={`edital-new-file-${disc.id}`}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) =>
                            setNewFiles((prev) => ({ ...prev, [disc.id]: e.target.files?.[0] || null }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {newFile ? `Arquivo selecionado: ${newFile.name}` : "Nenhum PDF selecionado."}
                        </p>
                      </div>
                    )}

                    <Button onClick={() => handleAdd(disc.id)} disabled={addingId === disc.id}>
                      {addingId === disc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : form.mode === "link" ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Adicionar material
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
