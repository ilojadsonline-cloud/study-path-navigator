import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Mail, Send, MessageSquare, User, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const Contato = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !email.trim() || !assunto.trim() || !mensagem.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    if (mensagem.trim().length < 10) {
      toast.error("A mensagem deve ter pelo menos 10 caracteres.");
      return;
    }

    setLoading(true);

    // Open mailto link
    const subject = encodeURIComponent(assunto.trim().slice(0, 200));
    const body = encodeURIComponent(
      `Nome: ${nome.trim().slice(0, 100)}\nE-mail: ${email.trim().slice(0, 255)}\n\n${mensagem.trim().slice(0, 2000)}`
    );
    window.location.href = `mailto:contato@metodochoa.com.br?subject=${subject}&body=${body}`;

    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1000);
  };

  if (sent) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-8 text-center space-y-4 mt-6"
          >
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Mensagem preparada!</h2>
            <p className="text-sm text-muted-foreground">
              Seu cliente de e-mail foi aberto com a mensagem. Caso não tenha aberto, envie diretamente para{" "}
              <a href="mailto:contato@metodochoa.com.br" className="text-primary font-semibold hover:underline">
                contato@metodochoa.com.br
              </a>
            </p>
            <button
              onClick={() => {
                setSent(false);
                setNome("");
                setEmail("");
                setAssunto("");
                setMensagem("");
              }}
              className="px-6 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Enviar outra mensagem
            </button>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <BackButton />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient-primary">Fale Conosco</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tem alguma dúvida, sugestão ou problema? Entre em contato!
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="glass-card rounded-xl p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={100}
              placeholder="Seu nome"
              className="w-full rounded-lg bg-secondary border-none text-sm p-3 text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="seu@email.com"
              className="w-full rounded-lg bg-secondary border-none text-sm p-3 text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Assunto
            </label>
            <input
              type="text"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              maxLength={200}
              placeholder="Sobre o que deseja falar?"
              className="w-full rounded-lg bg-secondary border-none text-sm p-3 text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Mensagem
            </label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Descreva sua dúvida, sugestão ou problema..."
              className="w-full rounded-lg bg-secondary border-none text-sm p-3 text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Mensagem
              </>
            )}
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            Ou envie diretamente para{" "}
            <a href="mailto:contato@metodochoa.com.br" className="text-primary hover:underline">
              contato@metodochoa.com.br
            </a>
          </p>
        </motion.form>
      </div>
    </AppLayout>
  );
};

export default Contato;
