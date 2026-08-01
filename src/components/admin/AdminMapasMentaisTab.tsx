import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { disciplinasLite, disciplinasSelecionaveis } from "@/lib/edital-structure";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Trash2, FileDown, Brain, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";

type MapaRow = {
  id: string;
  disciplina_id: string;
  topico: string;
  nome_arquivo: string;
  storage_path: string;
  created_at: string;
};

export function AdminMapasMentaisTab() {
  const [rows, setRows] = useState<MapaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [discId, setDiscId] = useState<string>(disciplinasSelecionaveis[0].id);
  const [titulo, setTitulo] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // edição inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mapas_mentais")
      .select("*")
      .order("disciplina_id", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error("Erro ao carregar mapas mentais");
    setRows((data as MapaRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const handleUpload = async () => {
    if (!titulo.trim()) { toast.error("Informe o título do mapa mental"); return; }
    if (!file) { toast.error("Selecione um arquivo PDF"); return; }
    if (file.type !== "application/pdf") { toast.error("O arquivo deve ser PDF"); return; }
    if (!discId) { toast.error("Selecione a disciplina"); return; }
    setUploading(true);
    try {
      const safeTitle = titulo.trim().replace(/[^\w\d-]+/g, "_").slice(0, 80);
      const path = `${discId}/${safeTitle}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("mapas-mentais")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("mapas_mentais")
        .insert({ disciplina_id: discId, topico: titulo.trim(), nome_arquivo: file.name, storage_path: path });
      if (insErr) throw insErr;

      toast.success("Mapa mental adicionado");
      setTitulo("");
      setFile(null);
      const input = document.getElementById("mm-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (row: MapaRow) => {
    setEditId(row.id);
    setEditTitulo(row.topico);
    setEditFile(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitulo("");
    setEditFile(null);
  };

  const handleSaveEdit = async (row: MapaRow) => {
    if (!editTitulo.trim()) { toast.error("Informe o título"); return; }
    if (editFile && editFile.type !== "application/pdf") { toast.error("O arquivo deve ser PDF"); return; }
    setSavingEdit(true);
    try {
      let storage_path = row.storage_path;
      let nome_arquivo = row.nome_arquivo;

      if (editFile) {
        const safeTitle = editTitulo.trim().replace(/[^\w\d-]+/g, "_").slice(0, 80);
        const newPath = `${row.disciplina_id}/${safeTitle}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("mapas-mentais")
          .upload(newPath, editFile, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        await supabase.storage.from("mapas-mentais").remove([row.storage_path]);
        storage_path = newPath;
        nome_arquivo = editFile.name;
      }

      const { error: updErr } = await supabase
        .from("mapas_mentais")
        .update({ topico: editTitulo.trim(), storage_path, nome_arquivo })
        .eq("id", row.id);
      if (updErr) throw updErr;

      toast.success("Mapa mental atualizado");
      cancelEdit();
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (row: MapaRow) => {
    if (!confirm(`Excluir mapa mental: ${row.topico}?`)) return;
    setDeletingId(row.id);
    try {
      await supabase.storage.from("mapas-mentais").remove([row.storage_path]);
      const { error } = await supabase.from("mapas_mentais").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Removido");
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpen = async (row: MapaRow) => {
    const { data, error } = await supabase.storage
      .from("mapas-mentais")
      .createSignedUrl(row.storage_path, 60 * 10);
    if (error || !data?.signedUrl) { toast.error("URL inválida"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const discTitle = (id: string) => disciplinasLite.find((d) => d.id === id)?.title || id;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" /> Novo Mapa Mental
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Disciplina</label>
            <Select value={discId} onValueChange={setDiscId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {disciplinasSelecionaveis.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título do mapa</label>
            <Input
              placeholder="Ex.: Lei nº 2.578 - Mapa completo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground mb-1 block">Arquivo PDF</label>
            <Input
              id="mm-file-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !file || !titulo.trim()}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada envio adiciona um novo mapa à disciplina. Você pode cadastrar vários mapas por disciplina; eles ficam listados abaixo.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-base mb-3">Mapas cadastrados</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum mapa cadastrado ainda.</p>
        ) : (
          <div className="space-y-5">
            {disciplinasLite.map((d) => {
              const items = rows.filter((r) => r.disciplina_id === d.id);
              if (items.length === 0) return null;
              return (
                <div key={d.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{discTitle(d.id)}</h3>
                  <div className="space-y-2">
                    {items.map((r, idx) => {
                      const isEditing = editId === r.id;
                      return (
                        <div key={r.id} className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editTitulo}
                                onChange={(e) => setEditTitulo(e.target.value)}
                                placeholder="Título do mapa"
                              />
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  Substituir arquivo (opcional)
                                </label>
                                <Input
                                  type="file"
                                  accept="application/pdf"
                                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => handleSaveEdit(r)} disabled={savingEdit}>
                                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  Salvar
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                                  <X className="w-4 h-4" /> Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-start gap-2">
                                <span className="text-xs font-bold text-primary mt-0.5">{idx + 1}.</span>
                                <div className="min-w-0">
                                  <p className="text-sm text-foreground truncate">{r.topico}</p>
                                  <p className="text-xs text-muted-foreground truncate">{r.nome_arquivo}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button size="sm" variant="outline" onClick={() => handleOpen(r)}>
                                  <FileDown className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deletingId === r.id}
                                  onClick={() => handleDelete(r)}
                                >
                                  {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminMapasMentaisTab;
