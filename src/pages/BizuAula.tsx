import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Youtube, ChevronDown, ChevronUp, Loader2, Inbox, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { disciplinasLite } from "@/lib/edital-structure";
import { PopSigilosoNotice, PopSigilosoBadge } from "@/components/PopSigilosoNotice";
import { toast } from "sonner";

type VideoRow = {
  id: string;
  disciplina_id: string;
  titulo: string;
  url_youtube: string;
  ordem: number;
};

// Extrai id do YouTube de variadas formas de URL
export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
    if (m) return m[2];
    return null;
  } catch {
    const m = url.match(/[\w-]{11}/);
    return m ? m[0] : null;
  }
}

function VideoCard({ row }: { row: VideoRow }) {
  const [playing, setPlaying] = useState(false);
  const videoId = getYoutubeId(row.url_youtube);
  if (!videoId) {
    return (
      <a
        href={row.url_youtube}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl bg-secondary/40 border border-border/30 p-3 text-sm text-foreground hover:bg-secondary/60 transition"
      >
        {row.titulo}
      </a>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden bg-secondary/40 border border-border/30">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={row.titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={`Reproduzir: ${row.titulo}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={row.titulo}
              loading="lazy"
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full gradient-gold flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-gold-foreground ml-0.5" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{row.titulo}</p>
      </div>
    </div>
  );
}

export default function BizuAula() {
  const [params] = useSearchParams();
  const initialDisc = params.get("disciplina") || disciplinasLite[0].id;
  const [openId, setOpenId] = useState<string>(initialDisc);
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("bizuaulas_videos")
        .select("id, disciplina_id, titulo, url_youtube, ordem")
        .order("disciplina_id", { ascending: true })
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (!alive) return;
      if (error) toast.error("Erro ao carregar BizuAulas");
      setRows((data as VideoRow[]) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const byDisc = useMemo(() => {
    const m = new Map<string, VideoRow[]>();
    for (const r of rows) {
      const arr = m.get(r.disciplina_id) || [];
      arr.push(r);
      m.set(r.disciplina_id, arr);
    }
    return m;
  }, [rows]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-gradient-primary flex items-center gap-2">
            <Youtube className="w-6 h-6" /> BizuAula
          </h1>
          <p className="text-sm text-muted-foreground">
            Videoaulas curadas por disciplina para acelerar seus estudos.
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
              const videos = byDisc.get(d.id) || [];
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
                      <Youtube className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-sm md:text-base text-foreground leading-tight">{d.title}</h2>
                        {d.restricted && <PopSigilosoBadge />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.restricted
                          ? "Documento sigiloso"
                          : videos.length > 0 ? `${videos.length} vídeo${videos.length > 1 ? "s" : ""}` : "Em breve"}
                      </p>
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
                        <div className="px-5 pb-5">
                          {videos.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-6 rounded-xl bg-muted/20 text-muted-foreground text-sm">
                              <Inbox className="w-4 h-4" /> Em breve
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {videos.map((v) => (
                                <VideoCard key={v.id} row={v} />
                              ))}
                            </div>
                          )}
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
