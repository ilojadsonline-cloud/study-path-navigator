import { Lock } from "lucide-react";

/**
 * Ressalva exibida onde a disciplina POP apareceria.
 * O Manual do POP possui grau sigiloso RESERVADO (Portaria nº 021/2015-Gab. PMTO),
 * portanto não é disponibilizado na plataforma.
 */
export function PopSigilosoNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive ${className}`}
    >
      <Lock className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed space-y-2">
        <p>
          <strong>Disciplina não disponibilizada na plataforma.</strong> Em respeito ao
          caráter sigiloso do documento, o POP não será adicionado (texto de referência,
          questões, mapas mentais ou videoaulas), em conformidade com a normativa interna da PMTO.
        </p>
        <p className="text-muted-foreground">
          Fundamento: <strong>Portaria nº 021/2015-Gab.</strong> (PMTO — Quartel do Comando
          Geral), que atribui grau sigiloso <strong>RESERVADO</strong> ao Manual do Procedimento
          Operacional Padrão (POP) e regula sua divulgação, com base no art. 10 da Lei Complementar
          nº 79/2012 e nos arts. 24 e 27, III c/c art. 45 da Lei nº 12.527/2011. Toda publicação ou
          reprodução, total ou parcial, depende de autorização do Comandante-Geral, restringindo-se
          o acesso à comunidade policial militar e setores afins. O estudo do POP deve ser feito por
          canais oficiais da Corporação.
        </p>
      </div>
    </div>
  );
}

export function PopSigilosoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[10px] font-bold uppercase tracking-wide shrink-0">
      <Lock className="w-3 h-3" />
      Sigiloso
    </span>
  );
}
