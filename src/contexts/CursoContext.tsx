import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Curso {
  id: string;
  slug: string;
  nome: string;
  sigla: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  visivel: boolean;
}

interface CursoContextType {
  cursos: Curso[];            // cursos que o usuário pode acessar
  todosCursos: Curso[];       // todos os cursos ativos (para a tela de escolha)
  cursoAtivo: Curso | null;
  cursoId: string | null;
  setCursoSlug: (slug: string) => void;
  temAcesso: (curso: Curso | null) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}


const STORAGE_KEY = "choa.curso.slug";
const DEFAULT_SLUG = "pmto";

const CursoContext = createContext<CursoContextType>({
  cursos: [],
  todosCursos: [],
  cursoAtivo: null,
  cursoId: null,
  setCursoSlug: () => {},
  temAcesso: () => false,
  loading: true,
  refresh: async () => {},
});


export const useCurso = () => useContext(CursoContext);

/**
 * Filtro reutilizável para tabelas de conteúdo com coluna `curso_id`.
 * Inclui registros sem curso definido (legado) para não esconder nada do que já existe.
 */
export const cursoOrFilter = (cursoId: string | null) =>
  cursoId ? `curso_id.eq.${cursoId},curso_id.is.null` : null;

export function CursoProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [todos, setTodos] = useState<Curso[]>([]);
  const [acessos, setAcessos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_SLUG);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cursosData } = await supabase
      .from("cursos")
      .select("id, slug, nome, sigla, cor, ordem, ativo, visivel")
      .order("ordem");
    setTodos(((cursosData as Curso[]) || []).filter((c) => c.ativo));

    if (user) {
      const { data } = await supabase
        .from("acessos_curso")
        .select("curso_id, ativo, expires_at")
        .eq("user_id", user.id);
      const now = Date.now();
      setAcessos(
        ((data as any[]) || [])
          .filter((a) => a.ativo && (!a.expires_at || new Date(a.expires_at).getTime() > now))
          .map((a) => a.curso_id as string),
      );
    } else {
      setAcessos([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const cursos = useMemo(() => {
    if (isAdmin) return todos;
    // Curso visível (aberto a todos os assinantes) OU com acesso explícito concedido
    return todos.filter((c) => c.visivel || acessos.includes(c.id));
  }, [todos, acessos, isAdmin]);

  const cursoAtivo = useMemo(() => {
    if (cursos.length === 0) return null;
    return cursos.find((c) => c.slug === slug) || cursos.find((c) => c.slug === DEFAULT_SLUG) || cursos[0];
  }, [cursos, slug]);

  const setCursoSlug = useCallback((s: string) => {
    localStorage.setItem(STORAGE_KEY, s);
    setSlug(s);
  }, []);

  const temAcesso = useCallback(
    (curso: Curso | null) => {
      if (!curso) return false;
      if (isAdmin) return true;
      if (acessos.includes(curso.id)) return true;
      // Legado: assinantes antigos (sem registro em acessos_curso) mantêm o CHOA PMTO
      if (subscribed && curso.slug === DEFAULT_SLUG) return true;
      return false;
    },
    [acessos, isAdmin, subscribed],
  );

  return (
    <CursoContext.Provider
      value={{
        cursos,
        todosCursos: todos,
        cursoAtivo,
        cursoId: cursoAtivo?.id ?? null,
        setCursoSlug,
        temAcesso,
        loading,
        refresh: load,
      }}
    >

      {children}
    </CursoContext.Provider>
  );
}
