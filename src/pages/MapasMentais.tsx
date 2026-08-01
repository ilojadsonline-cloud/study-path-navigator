import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Brain, FileDown, ChevronDown, ChevronUp, BookMarked, Loader2, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurso, cursoOrFilter } from "@/contexts/CursoContext";
import { disciplinasLite } from "@/lib/edital-structure";
import { PopSigilosoNotice, PopSigilosoBadge } from "@/components/PopSigilosoNotice";
import { toast } from "sonner";

type MapaRow = {
  id: string;
  disciplina_id: string;
  topico: string;
  nome_arquivo: string;
  storage_path: string;
};

export default function MapasMentais() {
  const [params] = useSearchParams();
  const initialDisc = params.get("disciplina") || disciplinasLite[0].id;
  const [openId, setOpenId] = useState<string>(initialDisc);
  const [rows, setRows] = useState<MapaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const { cursoId } = useCurso();

  useEffect(() => {
    let alive = true;
    (async () => {
      let q = supabase
        .from("mapas_mentais")
        .select("id, disciplina_id, topico, nome_arquivo, storage_path");
      const cf = cursoOrFilter(cursoId);
      if (cf) q = q.or(cf);
      const { data, error } = await q;
      if (!alive) return;
      if (error) toast.error("Erro ao carregar mapas mentais");
      setRows((data as MapaRow[]) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [cursoId]);

  const mapsByDisc = useMemo(() => {
    const m = new Map<string, MapaRow[]>();
    for (const r of rows) {
      const list = m.get(r.disciplina_id) || [];
      list.push(r);
      m.set(r.disciplina_id, list);
    }
    return m;
  }, [rows]);

  const openPdf = async (row: MapaRow) => {
    setOpeningId(row.id);
    try {
      const { data, error } = await supabase
        .storage
        .from("mapas-mentais")
        .createSignedUrl(row.storage_path, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error("URL inválida");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o PDF");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-gradient-primary flex items-center gap-2">
            <Brain className="w-6 h-6" /> Mapas Mentais
          </h1>
          <p className="text-sm text-muted-foreground">
            Mapas organizados por disciplina e tópico do Edital Verticalizado.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {disciplinasLite.map((d, i) => {
              const open = openId === d.id;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-2xl overflow-hidden border border-border/50"
                >
                  <button
                    onClick={() => setOpenId(open ? "" : d.id)}
                    className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-sm md:text-base text-foreground leading-tight">{d.title}</h2>
                        {d.restricted && <PopSigilosoBadge />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.subtitle}</p>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-2">
                          {d.restricted ? (
                            <PopSigilosoNotice />
                          ) : (() => {
                            const items = mapsByDisc.get(d.id) || [];
                            if (items.length === 0) {
                              return (
                                <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/30 border border-border/30 p-4 text-muted-foreground text-sm">
                                  <Inbox className="w-4 h-4" /> Nenhum mapa disponível ainda.
                                </div>
                              );
                            }
                            return items.map((row, idx) => (
                              <div
                                key={row.id}
                                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 border border-border/30 p-3"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-primary shrink-0">{idx + 1}.</span>
                                  <BookMarked className="w-4 h-4 text-primary shrink-0" />
                                  <span className="text-sm text-foreground truncate">{row.topico}</span>
                                </div>
                                <button
                                  onClick={() => openPdf(row)}
                                  disabled={openingId === row.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-gold text-gold-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
                                >
                                  {openingId === row.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="w-3.5 h-3.5" />
                                  )}
                                  Abrir PDF
                                </button>
                              </div>
                            ));
                          })()}
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
