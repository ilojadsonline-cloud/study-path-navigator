import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy } from "lucide-react";

const CONSENT_KEY = "ranking_consent_shown";

export function RankingConsentModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const alreadyShown = localStorage.getItem(`${CONSENT_KEY}_${user.id}`);
    if (alreadyShown) return;

    // Check if user already has a preference set (profile updated)
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("show_in_ranking")
        .eq("user_id", user.id)
        .single();

      // Only show if they haven't been asked yet (default false and no localStorage flag)
      if (data !== null) {
        setOpen(true);
      }
    };
    check();
  }, [user]);

  const handleChoice = async (showInRanking: boolean) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ show_in_ranking: showInRanking } as any)
      .eq("user_id", user.id);

    localStorage.setItem(`${CONSENT_KEY}_${user.id}`, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-6 h-6 text-gold" />
            <DialogTitle className="text-lg">🏆 Chegou o Ranking Top 10!</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Agora você pode acompanhar o seu desempenho e competir com outros guerreiros.
            Deseja participar do ranking público com o seu nome?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => handleChoice(false)}
            className="w-full sm:w-auto"
          >
            Não, prefiro ficar anônimo
          </Button>
          <Button
            onClick={() => handleChoice(true)}
            className="w-full sm:w-auto gradient-primary"
          >
            Sim, quero participar!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
