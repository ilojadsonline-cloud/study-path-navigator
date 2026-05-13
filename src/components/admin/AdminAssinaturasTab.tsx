import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, RefreshCw, ShieldOff, ShieldCheck, Users, UserX, CreditCard, TrendingUp, Search,
} from "lucide-react";

type OverviewUser = {
  user_id: string;
  nome: string;
  cpf: string;
  email: string | null;
  created_at: string;
  is_blocked: boolean;
  banned_until: string | null;
  last_sign_in_at: string | null;
  access_expires_at: string | null;
  reactivated_at: string | null;
  payment_source: string | null;
  trial_blocked: boolean;
};

type PaymentEvent = {
  id: string;
  user_id: string | null;
  email: string | null;
  payment_id: string | null;
  amount: number | null;
  payment_type: string | null;
  gateway: string | null;
  status: string | null;
  action_taken: string | null;
  processed_at: string;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
};

const daysLeft = (iso: string | null) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
};

const fmtBRL = (n: number | null) =>
  typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const sourceBadge = (src: string | null, daysRemaining: number | null) => {
  if (!src) return { label: "—", variant: "outline" as const };
  if (src === "mercadopago_avulso") return { label: `Pix/Boleto${daysRemaining != null ? ` — ${daysRemaining}d` : ""}`, variant: "secondary" as const };
  if (src === "mercadopago") return { label: "Cartão — automática", variant: "default" as const };
  if (src === "stripe") return { label: "Stripe — ativo", variant: "default" as const };
  return { label: src, variant: "outline" as const };
};

export function AdminAssinaturasTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<OverviewUser[]>([]);
  const [blocked, setBlocked] = useState<OverviewUser[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [confirm, setConfirm] = useState<{ user: OverviewUser; block: boolean } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: ovr, error: ovrErr }, eventsRes] = await Promise.all([
        supabase.functions.invoke("admin-manage-users", { body: { action: "subscription_overview" } }),
        supabase.from("payment_events").select("*").order("processed_at", { ascending: false }).limit(500),
      ]);
      if (ovrErr) throw ovrErr;
      setActive(ovr?.active || []);
      setBlocked(ovr?.blocked || []);
      if (eventsRes.error) throw eventsRes.error;
      setEvents((eventsRes.data || []) as PaymentEvent[]);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleToggleBlock = async (user: OverviewUser, block: boolean) => {
    setActingId(user.user_id);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "toggle_block", user_id: user.user_id, block },
      });
      if (error) throw error;
      toast({ title: block ? "Acesso bloqueado" : "Acesso reativado", description: user.email || user.nome });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setActingId(null);
      setConfirm(null);
    }
  };

  const filteredActive = useMemo(() => {
    if (!search) return active;
    const s = search.toLowerCase();
    return active.filter((u) => u.nome?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.cpf?.includes(s));
  }, [active, search]);

  const filteredBlocked = useMemo(() => {
    if (!search) return blocked;
    const s = search.toLowerCase();
    return blocked.filter((u) => u.nome?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.cpf?.includes(s));
  }, [blocked, search]);

  const filteredEvents = useMemo(() => {
    let evs = events;
    if (period !== "all") {
      const days = parseInt(period, 10);
      const cutoff = Date.now() - days * 24 * 3600 * 1000;
      evs = evs.filter((e) => new Date(e.processed_at).getTime() >= cutoff);
    }
    if (search) {
      const s = search.toLowerCase();
      evs = evs.filter((e) => e.email?.toLowerCase().includes(s) || e.payment_id?.toLowerCase().includes(s));
    }
    return evs;
  }, [events, period, search]);

  const monthMetrics = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEvents = events.filter((e) =>
      new Date(e.processed_at).getTime() >= start &&
      e.status === "approved" &&
      e.action_taken === "access_reactivated",
    );
    const total = monthEvents.length;
    const revenue = monthEvents.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    return { total, revenue };
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-3.5 h-3.5"/>Ativos</div>
          <p className="text-2xl font-bold mt-1">{active.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><UserX className="w-3.5 h-3.5"/>Bloqueados</div>
          <p className="text-2xl font-bold mt-1">{blocked.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CreditCard className="w-3.5 h-3.5"/>Pagamentos no mês</div>
          <p className="text-2xl font-bold mt-1">{monthMetrics.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="w-3.5 h-3.5"/>Receita no mês</div>
          <p className="text-2xl font-bold mt-1">{fmtBRL(monthMetrics.revenue)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Controle de Acesso</CardTitle>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5"/>Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Ativos ({active.length})</TabsTrigger>
              <TabsTrigger value="blocked">Bloqueados ({blocked.length})</TabsTrigger>
              <TabsTrigger value="events">Histórico</TabsTrigger>
            </TabsList>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/>
                <Input
                  placeholder="Buscar por nome, e-mail, CPF ou ID de pagamento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* ATIVOS */}
            <TabsContent value="active" className="mt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Reativado em</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Dias rest.</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActive.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum usuário ativo encontrado.</TableCell></TableRow>
                    ) : filteredActive.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.nome}</TableCell>
                        <TableCell className="text-xs">{u.email || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtDate(u.reactivated_at)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(u.access_expires_at)}</TableCell>
                        <TableCell>{daysLeft(u.access_expires_at) ?? "—"}</TableCell>
                        <TableCell>
                          {u.payment_source ? <Badge variant="outline" className="capitalize">{u.payment_source}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm" variant="destructive"
                            disabled={actingId === u.user_id}
                            onClick={() => setConfirm({ user: u, block: true })}
                          >
                            {actingId === u.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <><ShieldOff className="w-3.5 h-3.5 mr-1"/>Bloquear</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* BLOQUEADOS */}
            <TabsContent value="blocked" className="mt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Bloqueado até</TableHead>
                      <TableHead>Último login</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlocked.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum usuário bloqueado.</TableCell></TableRow>
                    ) : filteredBlocked.map((u) => {
                      const expired = u.access_expires_at && new Date(u.access_expires_at) < new Date();
                      const reason = u.trial_blocked ? "Fim do teste" : expired ? "Acesso expirado (90d)" : "Bloqueio manual";
                      return (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.nome}</TableCell>
                          <TableCell className="text-xs">{u.email || "—"}</TableCell>
                          <TableCell className="text-xs">{u.cpf}</TableCell>
                          <TableCell className="text-xs">{fmtDate(u.banned_until)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(u.last_sign_in_at)}</TableCell>
                          <TableCell><Badge variant="secondary">{reason}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={actingId === u.user_id}
                              onClick={() => setConfirm({ user: u, block: false })}
                            >
                              {actingId === u.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <><ShieldCheck className="w-3.5 h-3.5 mr-1"/>Reativar</>}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="events" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum evento.</TableCell></TableRow>
                    ) : filteredEvents.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.processed_at)}</TableCell>
                        <TableCell className="text-xs">{e.email || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtBRL(e.amount)}</TableCell>
                        <TableCell className="text-xs">{e.payment_type || "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{e.gateway || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "approved" ? "default" : "secondary"}>{e.status || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{e.payment_id?.slice(0, 14) || "—"}</TableCell>
                        <TableCell className="text-xs">{e.action_taken || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.block ? "Bloquear acesso?" : "Reativar acesso?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.block
                ? `O usuário ${confirm?.user.nome} (${confirm?.user.email}) perderá o acesso à plataforma imediatamente. Os dados são preservados.`
                : `O usuário ${confirm?.user.nome} (${confirm?.user.email}) terá o acesso liberado imediatamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && handleToggleBlock(confirm.user, confirm.block)}
              className={confirm?.block ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
