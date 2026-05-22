import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { disciplinasLite } from "@/lib/edital-structure";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Trash2, FileDown, Brain } from "lucide-react";
import { toast } from "sonner";

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
  const [discId, setDiscId] = useState<string>(disciplinasLite[0].id);
  const [topico, setTopico] = useState<string>(disciplinasLite[0].topics[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const topicsForDisc = useMemo(
    () => disciplinasLite.find((d) => d.id === discId)?.topics || [],
    [discId]
  );

  useEffect(() => {
    if (!topicsForDisc.includes(topico)) setTopico(topicsForDisc[0] || "");
  }, [discId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mapas_mentais")
      .select("*")
      .order("disciplina_id", { ascending: true })
      .order("topico", { ascending: true });
    if (error) toast.error("Erro ao carregar mapas mentais");
    setRows((data as MapaRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const handleUpload = async () => {
    if (!file) { toast.error("Selecione um arquivo PDF"); return; }
    if (file.type !== "application/pdf") { toast.error("O arquivo deve ser PDF"); return; }
    if (!discId || !topico) { toast.error("Selecione disciplina e tópico"); return; }
    setUploading(true);
    try {
      const safeTopic = topico.replace(/[^\w\d-]+/g, "_").slice(0, 80);
      const path = `${discId}/${safeTopic}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("mapas-mentais")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      // Remove arquivo antigo se existir
      const existing = rows.find((r) => r.disciplina_id === discId && r.topico === topico);
      if (existing) {
        await supabase.storage.from("mapas-mentais").remove([existing.storage_path]);
        const { error: updErr } = await supabase
          .from("mapas_mentais")
          .update({ nome_arquivo: file.name, storage_path: path })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("mapas_mentais")
          .insert({ disciplina_id: discId, topico, nome_arquivo: file.name, storage_path: path });
        if (insErr) throw insErr;
      }

      toast.success("Mapa mental enviado");
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
                {disciplinasLite.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tópico</label>
            <Select value={topico} onValueChange={setTopico}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {topicsForDisc.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se já existir mapa mental para o mesmo tópico, ele será substituído.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-base mb-3">Mapas cadastrados</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum mapa cadastrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {disciplinasLite.map((d) => {
              const items = rows.filter((r) => r.disciplina_id === d.id);
              if (items.length === 0) return null;
              return (
                <div key={d.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{d.title}</h3>
                  <div className="space-y-1">
                    {items.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 border border-border/30 p-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{r.topico}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.nome_arquivo}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleOpen(r)}>
                            <FileDown className="w-4 h-4" />
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
                    ))}
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
