import { AppLayout } from "@/components/AppLayout";
import { Construction, Clock } from "lucide-react";

export default function MapasMentais() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient-primary mb-3">
          Mapas Mentais
        </h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Estamos construindo uma ferramenta poderosa de mapas mentais para
          acelerar sua memorização e conexão entre os temas do edital.
        </p>
        <div className="glass-card rounded-xl px-6 py-3 flex items-center gap-2 text-sm text-primary">
          <Clock className="w-4 h-4" />
          <span>Disponível em breve</span>
        </div>
      </div>
    </AppLayout>
  );
}
