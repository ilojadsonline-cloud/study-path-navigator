import logoUrl from "@/assets/logo-mc-choa.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  alt?: string;
}

/**
 * Logo oficial Método CHOA — cubo isométrico 3D azul.
 * Use `className` para definir tamanho (ex: "w-10 h-10").
 */
export function Logo({ className, alt = "Método CHOA" }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={cn("object-contain select-none", className)}
      draggable={false}
    />
  );
}
