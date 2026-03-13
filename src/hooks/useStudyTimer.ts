import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const INTERVAL_SECONDS = 60;
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const LS_KEY = "study_timer_state";

interface TimerState {
  sessionId: number | null;
  elapsed: number;
  lastActive: number;
}

function loadState(): TimerState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessionId: null, elapsed: 0, lastActive: Date.now() };
}

function saveState(state: TimerState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export function useStudyTimer() {
  const { user } = useAuth();
  const stateRef = useRef<TimerState>(loadState());
  const pausedRef = useRef(false);

  const markActive = useCallback(() => {
    stateRef.current.lastActive = Date.now();
    if (pausedRef.current) {
      pausedRef.current = false;
    }
    saveState(stateRef.current);
  }, []);

  useEffect(() => {
    if (!user) return;

    const state = stateRef.current;

    // Start or resume session
    const initSession = async () => {
      // If we have a valid session from localStorage, resume it
      if (state.sessionId) {
        // Check if session still exists
        const { data } = await supabase
          .from("study_sessions")
          .select("id")
          .eq("id", state.sessionId)
          .single();
        if (data) return; // session still valid
      }

      // Create new session
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({ user_id: user.id, duration_seconds: 0 })
        .select("id")
        .single();
      if (!error && data) {
        state.sessionId = data.id;
        state.elapsed = 0;
        state.lastActive = Date.now();
        saveState(state);
      }
    };

    initSession();

    // Activity listeners for inactivity detection
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    activityEvents.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    // Tick every INTERVAL_SECONDS
    const interval = setInterval(async () => {
      if (!state.sessionId) return;

      const now = Date.now();
      const inactive = now - state.lastActive > INACTIVITY_LIMIT_MS;

      if (inactive) {
        pausedRef.current = true;
        return; // Don't count inactive time
      }

      state.elapsed += INTERVAL_SECONDS;
      saveState(state);

      await supabase
        .from("study_sessions")
        .update({ duration_seconds: state.elapsed })
        .eq("id", state.sessionId);
    }, INTERVAL_SECONDS * 1000);

    // Save on page unload
    const handleUnload = () => {
      if (!state.sessionId) return;
      const now = Date.now();
      if (now - state.lastActive <= INACTIVITY_LIMIT_MS) {
        // Only add time if user was recently active
        state.elapsed += Math.min(INTERVAL_SECONDS, Math.floor((now - state.lastActive) / 1000));
      }
      saveState(state);
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions?id=eq.${state.sessionId}`,
        JSON.stringify({ duration_seconds: state.elapsed })
      );
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      activityEvents.forEach(evt => window.removeEventListener(evt, markActive));
      // Final save on cleanup
      if (state.sessionId) {
        supabase
          .from("study_sessions")
          .update({ duration_seconds: state.elapsed })
          .eq("id", state.sessionId);
      }
    };
  }, [user, markActive]);
}
