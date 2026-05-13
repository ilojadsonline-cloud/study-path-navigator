import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

const PagamentoFalha = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 flex items-center justify-center mb-4">
        <XCircle className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Pagamento não concluído</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Houve um problema com seu pagamento. Tente novamente ou escolha outro método.
      </p>
      <Link
        to="/assinatura"
        className="inline-block px-6 py-3 rounded-xl gradient-gold text-gold-foreground font-bold text-sm hover:opacity-90"
      >
        Tentar novamente
      </Link>
    </div>
  </div>
);
export default PagamentoFalha;
