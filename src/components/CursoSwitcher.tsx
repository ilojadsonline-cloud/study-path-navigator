import { GraduationCap, Check, ChevronDown } from "lucide-react";
import { useCurso } from "@/contexts/CursoContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CursoSwitcher() {
  const { cursos, cursoAtivo, setCursoSlug } = useCurso();

  // Com um único curso disponível, nada muda para o usuário atual.
  if (!cursoAtivo || cursos.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">{cursoAtivo.sigla}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        {cursos.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setCursoSlug(c.slug)} className="gap-2">
            <span className="flex-1 text-sm">{c.nome}</span>
            {c.slug === cursoAtivo.slug && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
