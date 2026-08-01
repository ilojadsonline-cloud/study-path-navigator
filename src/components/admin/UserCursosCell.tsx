import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface CursoRow { id: string; slug: string; sigla: string; nome: string; visivel: boolean }

let cursosCache: CursoRow[] | null = null;

export function UserCursosCell({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [cursos, setCursos] = useState<CursoRow[]>(cursosCache || []);
  const [acessos, setAcessos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!cursosCache) {
      const { data } = await supabase
        .from("cursos")
        .select("id, slug, sigla, nome, visivel")
        .eq("ativo", true)
        .order("ordem");
      cursosCache = (data as CursoRow[]) || [];
    }
    setCursos(cursosCache);
    const { data: acc } = await supabase
      .from("acessos_curso")
      .select("curso_id, ativo, expires_at")
      .eq("user_id", userId);
    const now = Date.now();
    setAcessos(
      ((acc as any[]) || [])
        .filter((a) => a.ativo && (!a.expires_at || new Date(a.expires_at).getTime() > now))
        .map((a) => a.curso_id as string),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const toggle = async (curso: CursoRow) => {
    setSaving(curso.id);
    const tem = acessos.includes(curso.id);
    if (tem) {
      const { error } = await supabase
        .from("acessos_curso")
        .update({ ativo: false })
        .eq("user_id", userId)
        .eq("curso_id", curso.id);
      if (error) toast({ title: "Erro ao remover acesso", description: error.message, variant: "destructive" });
      else setAcessos((prev) => prev.filter((id) => id !== curso.id));
    } else {
      const { error } = await supabase
        .from("acessos_curso")
        .upsert(
          { user_id: userId, curso_id: curso.id, origem: "manual_admin", ativo: true },
          { onConflict: "user_id,curso_id" },
        );
      if (error) toast({ title: "Erro ao conceder acesso", description: error.message, variant: "destructive" });
      else setAcessos((prev) => [...prev, curso.id]);
    }
    setSaving(null);
  };

  if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;

  const ativos = cursos.filter((c) => acessos.includes(c.id) || c.visivel);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
          {ativos.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            ativos.map((c) => (
              <Badge key={c.id} variant="secondary" className="text-[10px] px-1.5">{c.sigla}</Badge>
            ))
          )}
          <GraduationCap className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 bg-popover z-50 space-y-2">
        <p className="text-xs font-semibold">Acesso por curso</p>
        {cursos.map((c) => {
          const tem = acessos.includes(c.id);
          return (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{c.nome}</p>
                {c.visivel && !tem && (
                  <p className="text-[10px] text-muted-foreground">Aberto a todos os assinantes</p>
                )}
              </div>
              <Button
                size="sm"
                variant={tem ? "outline" : "default"}
                className="h-7 text-[11px]"
                disabled={saving === c.id}
                onClick={() => toggle(c)}
              >
                {saving === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : tem ? "Remover" : "Conceder"}
              </Button>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
