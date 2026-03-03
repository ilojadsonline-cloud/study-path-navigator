import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  className?: string;
  glowing?: boolean;
}

export function StatCard({ title, value, icon, subtitle, className, glowing }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "glass-card rounded-xl p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-300",
        glowing && "glow-primary",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 gradient-primary opacity-5 rounded-full -translate-y-8 translate-x-8 group-hover:opacity-10 transition-opacity" />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-bold text-foreground">{value}</h3>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
      {subtitle && (
        <p className="text-[10px] text-primary mt-2 font-medium">{subtitle}</p>
      )}
    </motion.div>
  );
}
