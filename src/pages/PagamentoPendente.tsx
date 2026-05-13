import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

const PagamentoPendente = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-warning/15 flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-warning" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Pagamento em processamento</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Assim que confirmado, seu acesso será liberado automaticamente. Se você
        pagou com boleto, a compensação pode levar até 3 dias úteis.
      </p>
      <Link
        to="/dashboard"
        className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90"
      >
        Ir para o painel
      </Link>
    </div>
  </div>
);
export default PagamentoPendente;
