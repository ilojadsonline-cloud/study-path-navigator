import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const PagamentoSucesso = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8 text-success" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Seu acesso será liberado em instantes. Se você pagou com Pix ou boleto,
        a confirmação pode levar alguns minutos para chegar.
      </p>
      <Link
        to="/dashboard"
        className="inline-block px-6 py-3 rounded-xl gradient-gold text-gold-foreground font-bold text-sm hover:opacity-90"
      >
        Ir para o painel
      </Link>
    </div>
  </div>
);
export default PagamentoSucesso;
