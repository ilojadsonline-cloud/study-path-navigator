import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bizuAulaDisciplinas, bizuAulaSelecionaveis } from "@/lib/edital-structure";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Save, Youtube, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { getYoutubeId } from "@/pages/BizuAula";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";

type VideoRow = {
  id: string;
  disciplina_id: string;
  titulo: string;
  url_youtube: string;
  ordem: number;
};

export function AdminBizuAulaTab() {
  const { cursoId } = useCurso();
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [discId, setDiscId] = useState<string>(bizuAulaDisciplinas[0].id);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    let query = supabase
      .from("bizuaulas_videos")
      .select("*")
      .order("disciplina_id", { ascending: true })
      .order("ordem", { ascending: true });
    const filter = cursoOrFilter(cursoId);
    if (filter) query = query.or(filter);
    const { data, error } = await query;
    if (error) toast.error("Erro ao carregar vídeos");
    setRows((data as VideoRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cursoId]);


  const byDisc = useMemo(() => {
    const m = new Map<string, VideoRow[]>();
    for (const r of rows) {
      const arr = m.get(r.disciplina_id) || [];
      arr.push(r);
      m.set(r.disciplina_id, arr);
    }
    return m;
  }, [rows]);

  const handleAdd = async () => {
    if (!titulo.trim() || !url.trim()) { toast.error("Preencha título e URL"); return; }
    if (!getYoutubeId(url)) { toast.error("URL do YouTube inválida"); return; }
    setSaving(true);
    try {
      const existing = byDisc.get(discId) || [];
      const nextOrdem = existing.length ? Math.max(...existing.map(v => v.ordem)) + 1 : 0;
      const { error } = await supabase.from("bizuaulas_videos").insert({
        disciplina_id: discId,
        titulo: titulo.trim(),
        url_youtube: url.trim(),
        ordem: nextOrdem,
        curso_id: cursoId,
      });
      if (error) throw error;
      toast.success("Vídeo adicionado");
      setTitulo(""); setUrl("");
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally { setSaving(false); }
  };

  const startEdit = (r: VideoRow) => {
    setEditingId(r.id);
    setEditTitulo(r.titulo);
    setEditUrl(r.url_youtube);
  };

  const saveEdit = async (id: string) => {
    if (!editTitulo.trim() || !editUrl.trim()) { toast.error("Preencha título e URL"); return; }
    if (!getYoutubeId(editUrl)) { toast.error("URL do YouTube inválida"); return; }
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("bizuaulas_videos")
        .update({ titulo: editTitulo.trim(), url_youtube: editUrl.trim() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Atualizado");
      setEditingId(null);
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setBusyId(null); }
  };

  const handleDelete = async (r: VideoRow) => {
    if (!confirm(`Excluir "${r.titulo}"?`)) return;
    setBusyId(r.id);
    try {
      const { error } = await supabase.from("bizuaulas_videos").delete().eq("id", r.id);
      if (error) throw error;
      toast.success("Removido");
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    } finally { setBusyId(null); }
  };

  const move = async (r: VideoRow, dir: -1 | 1) => {
    const list = (byDisc.get(r.disciplina_id) || []).slice().sort((a, b) => a.ordem - b.ordem);
    const idx = list.findIndex((v) => v.id === r.id);
    const swap = list[idx + dir];
    if (!swap) return;
    setBusyId(r.id);
    try {
      // Swap em duas etapas para evitar conflito de unique (não há, mas mantém limpo)
      await supabase.from("bizuaulas_videos").update({ ordem: swap.ordem }).eq("id", r.id);
      await supabase.from("bizuaulas_videos").update({ ordem: r.ordem }).eq("id", swap.id);
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reordenar");
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Youtube className="w-5 h-5 text-primary" /> Nova BizuAula
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Disciplina</label>
            <Select value={discId} onValueChange={setDiscId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {bizuAulaSelecionaveis.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Hierarquia Militar — Aula 01" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-muted-foreground mb-1 block">URL do YouTube</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-base mb-3">Vídeos cadastrados</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum vídeo cadastrado ainda.</p>
        ) : (
          <div className="space-y-5">
            {bizuAulaDisciplinas.map((d) => {
              const items = (byDisc.get(d.id) || []).slice().sort((a, b) => a.ordem - b.ordem);
              if (items.length === 0) return null;
              return (
                <div key={d.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{d.title}</h3>
                  <div className="space-y-1">
                    {items.map((r, idx) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 border border-border/30 p-3">
                        {editingId === r.id ? (
                          <div className="flex-1 grid gap-2 md:grid-cols-2">
                            <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
                            <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{r.titulo}</p>
                            <a href={r.url_youtube} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                              {r.url_youtube}
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          {editingId === r.id ? (
                            <>
                              <Button size="sm" variant="default" disabled={busyId === r.id} onClick={() => saveEdit(r.id)}>
                                {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" disabled={idx === 0 || busyId === r.id} onClick={() => move(r, -1)}>
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" disabled={idx === items.length - 1 || busyId === r.id} onClick={() => move(r, 1)}>
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => handleDelete(r)}>
                                {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </>
                          )}
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

export default AdminBizuAulaTab;
