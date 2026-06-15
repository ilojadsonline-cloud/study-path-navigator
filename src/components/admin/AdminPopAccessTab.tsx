import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, Plus, Trash2, Search, ShieldCheck, RefreshCw, UserCheck, Link2 } from "lucide-react";

type Allow = { id: string; matricula: string | null; rg: string | null; cpf: string | null; nome_completo: string | null };
type Grant = { id: string; user_id: string; created_at: string };
type ProfileLite = { user_id: string; nome: string | null; email: string | null; cpf: string | null };

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

export function AdminPopAccessTab() {
  const { toast } = useToast();

  const [allow, setAllow] = useState<Allow[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [grantProfiles, setGrantProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  // single add form
  const [form, setForm] = useState({ nome_completo: "", cpf: "", rg: "", matricula: "" });
  const [saving, setSaving] = useState(false);

  // bulk paste
  const [bulk, setBulk] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // user grant search
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfileLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, gRes] = await Promise.all([
      supabase.from("pop_allowlist").select("*").order("nome_completo"),
      supabase.from("pop_access").select("*").order("created_at", { ascending: false }),
    ]);
    setAllow((aRes.data as Allow[]) || []);
    const g = (gRes.data as Grant[]) || [];
    setGrants(g);
    if (g.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome, email, cpf")
        .in("user_id", g.map((x) => x.user_id));
      const map: Record<string, ProfileLite> = {};
      (profs as ProfileLite[] | null)?.forEach((p) => { map[p.user_id] = p; });
      setGrantProfiles(map);
    } else {
      setGrantProfiles({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addOne = async () => {
    if (!form.cpf.trim() && !form.nome_completo.trim()) {
      toast({ title: "Preencha ao menos CPF e nome", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pop_allowlist").insert({
      nome_completo: form.nome_completo.trim() || null,
      cpf: onlyDigits(form.cpf) || null,
      rg: form.rg.trim() || null,
      matricula: form.matricula.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Adicionado à lista de autorizados" });
    setForm({ nome_completo: "", cpf: "", rg: "", matricula: "" });
    load();
  };

  const addBulk = async () => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    // formato por linha: Nome ; CPF ; RG ; Matrícula  (separador ; , ou TAB)
    const rows = lines.map((l) => {
      const parts = l.split(/[;\t,]/).map((p) => p.trim());
      return {
        nome_completo: parts[0] || null,
        cpf: onlyDigits(parts[1] || "") || null,
        rg: parts[2] || null,
        matricula: parts[3] || null,
      };
    });
    setBulkSaving(true);
    const { error } = await supabase.from("pop_allowlist").insert(rows);
    setBulkSaving(false);
    if (error) { toast({ title: "Erro na importação", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${rows.length} militares importados` });
    setBulk("");
    load();
  };

  const removeAllow = async (id: string) => {
    const { error } = await supabase.from("pop_allowlist").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setAllow((prev) => prev.filter((a) => a.id !== id));
  };

  const runSearch = async () => {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, email, cpf")
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%,cpf.ilike.%${q}%`)
      .limit(10);
    setResults((data as ProfileLite[]) || []);
    setSearching(false);
  };

  const grantUser = async (p: ProfileLite) => {
    const { error } = await supabase.from("pop_access").insert({ user_id: p.user_id });
    if (error) {
      toast({ title: "Erro", description: error.message.includes("duplicate") ? "Usuário já liberado." : error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Acesso liberado para ${p.nome || p.email}` });
    setResults([]);
    setSearch("");
    load();
  };

  const revokeGrant = async (id: string) => {
    const { error } = await supabase.from("pop_access").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setGrants((prev) => prev.filter((g) => g.id !== id));
  };

  const popLink = `${window.location.origin}/pop-questoes`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <h2 className="text-lg font-bold mb-1">Acesso ao POP (Sigiloso)</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Controle quem pode acessar as questões do POP. Têm acesso: administradores, militares cujo
              <strong> CPF</strong> conste na lista oficial abaixo, e usuários liberados manualmente.
            </p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* Direct link */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <Link2 className="w-4 h-4 text-primary shrink-0" />
        <code className="text-xs text-muted-foreground break-all flex-1">{popLink}</code>
        <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(popLink); toast({ title: "Link copiado" }); }}>
          Copiar link
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Liberação manual por usuário */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><UserCheck className="w-4 h-4 text-primary" /> Liberar usuário cadastrado</h3>
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Buscar por nome, e-mail ou CPF..."
              />
              <Button type="button" variant="secondary" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="space-y-1">
                {results.map((p) => (
                  <div key={p.user_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email} {p.cpf ? `· ${p.cpf}` : ""}</p>
                    </div>
                    <Button size="sm" onClick={() => grantUser(p)} className="gradient-primary text-primary-foreground shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Liberar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {grants.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground mb-1">Usuários liberados manualmente ({grants.length})</p>
                {grants.map((g) => {
                  const p = grantProfiles[g.user_id];
                  return (
                    <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30">
                      <div className="min-w-0 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p?.nome || g.user_id}</p>
                          <p className="text-xs text-muted-foreground truncate">{p?.email}</p>
                        </div>
                      </div>
                      <button onClick={() => revokeGrant(g.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista oficial (planilha) */}
          <div className="glass-card rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-sm">Lista oficial de autorizados ({allow.length})</h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Nome completo" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
              <Input placeholder="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              <Input placeholder="RG" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="Matrícula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                <Button onClick={addOne} disabled={saving} className="gradient-primary text-primary-foreground shrink-0">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Importação em massa (uma pessoa por linha): <code>Nome ; CPF ; RG ; Matrícula</code> (separe por <code>;</code>, vírgula ou TAB)
              </p>
              <Textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"João da Silva ; 000.000.000-00 ; 1234567 ; 12-345\nMaria Souza ; 111.111.111-11 ; 7654321 ; 67-890"}
                className="h-28 text-xs"
              />
              <Button onClick={addBulk} disabled={bulkSaving || !bulk.trim()} variant="secondary">
                {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Importar lista
              </Button>
            </div>

            {allow.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                      <th className="py-2 pr-2">Nome</th>
                      <th className="py-2 pr-2">CPF</th>
                      <th className="py-2 pr-2">RG</th>
                      <th className="py-2 pr-2">Matrícula</th>
                      <th className="py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allow.map((a) => (
                      <tr key={a.id} className="border-b border-border/30">
                        <td className="py-2 pr-2">{a.nome_completo || "—"}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{a.cpf || "—"}</td>
                        <td className="py-2 pr-2 text-xs">{a.rg || "—"}</td>
                        <td className="py-2 pr-2 text-xs">{a.matricula || "—"}</td>
                        <td className="py-2">
                          <button onClick={() => removeAllow(a.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
