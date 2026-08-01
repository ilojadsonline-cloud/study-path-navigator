import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, ShieldCheck, Sparkles } from "lucide-react";
import { useCurso } from "@/contexts/CursoContext";
import { CbmtoFontesCard } from "./CbmtoFontesCard";
import { CbmtoGerarCard } from "./CbmtoGerarCard";
import { CbmtoBancaCard } from "./CbmtoBancaCard";

export function AdminCbmtoEditorialTab() {
  const { cursoSlug } = useCurso();
  const [refreshKey, setRefreshKey] = useState(0);

  if (cursoSlug !== "cbmto") {
    return (
      <Alert>
        <AlertDescription>
          Este módulo é exclusivo do CHOA CBMTO 2026. Troque o curso ativo para CBMTO para utilizá-lo.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-xs">
          Fluxo vinculante: cadastre e valide as fontes locais → gere com escopo, cotas e gabarito planejados →
          audite nas 5 camadas e na matriz de 11 critérios → publique apenas o que for aprovado.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="fontes">
        <TabsList>
          <TabsTrigger value="fontes" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Fontes oficiais</TabsTrigger>
          <TabsTrigger value="gerar" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" />Gerar</TabsTrigger>
          <TabsTrigger value="banca" className="text-xs gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Banca e auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="fontes" className="mt-4"><CbmtoFontesCard /></TabsContent>
        <TabsContent value="gerar" className="mt-4">
          <CbmtoGerarCard onGerado={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="banca" className="mt-4"><CbmtoBancaCard refreshKey={refreshKey} /></TabsContent>
      </Tabs>
    </div>
  );
}
