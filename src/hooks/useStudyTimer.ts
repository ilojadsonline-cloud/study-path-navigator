import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const INTERVAL_SECONDS = 60; // update every 60 seconds

export function useStudyTimer() {
  const { user } = useAuth();
  const sessionIdRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    // Create a new study session
    const startSession = async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({ user_id: user.id, duration_seconds: 0 })
        .select("id")
        .single();
      if (!error && data) {
        sessionIdRef.current = data.id;
      }
    };

    startSession();

    // Update duration every INTERVAL_SECONDS
    const interval = setInterval(async () => {
      if (!sessionIdRef.current) return;
      elapsedRef.current += INTERVAL_SECONDS;
      await supabase
        .from("study_sessions")
        .update({ duration_seconds: elapsedRef.current })
        .eq("id", sessionIdRef.current);
    }, INTERVAL_SECONDS * 1000);

    // Save on page unload
    const handleUnload = () => {
      if (!sessionIdRef.current) return;
      elapsedRef.current += INTERVAL_SECONDS; // approximate
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions?id=eq.${sessionIdRef.current}`,
        JSON.stringify({ duration_seconds: elapsedRef.current })
      );
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      // Final save on cleanup
      if (sessionIdRef.current) {
        supabase
          .from("study_sessions")
          .update({ duration_seconds: elapsedRef.current })
          .eq("id", sessionIdRef.current);
      }
    };
  }, [user]);
}
