import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const INTERVAL_SECONDS = 60;
const LS_KEY = "study_timer_state";

export interface TimerState {
  sessionId: number | null;
  elapsed: number;
  lastActive: number;
  lastTick: number;
  startedAt: string | null;
  userId: string | null;
}

function emptyState(): TimerState {
  const now = Date.now();
  return { sessionId: null, elapsed: 0, lastActive: now, lastTick: now, startedAt: null, userId: null };
}

function isSameLocalDay(a?: string | number | null, b: Date = new Date()): boolean {
  if (!a) return false;
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() && da.getMonth() === b.getMonth() && da.getDate() === b.getDate();
}

function loadState(): TimerState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch {}
  return emptyState();
}

export function getLocalStudyTimerSnapshot(): TimerState {
  return loadState();
}

function saveState(state: TimerState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

function notifyTimerUpdated(state: TimerState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("study-timer-updated", { detail: state }));
}

export function useStudyTimer() {
  const { user } = useAuth();
  const stateRef = useRef<TimerState>(loadState());

  const markActive = useCallback(() => {
    const now = Date.now();
    stateRef.current.lastActive = now;
    saveState(stateRef.current);
  }, []);

  useEffect(() => {
    if (!user) return;

    const state = stateRef.current;
    const resetForNewSession = () => {
      const now = Date.now();
      state.sessionId = null;
      state.elapsed = 0;
      state.lastActive = now;
      state.lastTick = now;
      state.startedAt = null;
      state.userId = user.id;
      saveState(state);
      notifyTimerUpdated(state);
    };

    if ((state.userId && state.userId !== user.id) || (state.startedAt && !isSameLocalDay(state.startedAt))) {
      resetForNewSession();
    }

    // Start or resume session
    const initSession = async () => {
      // If we have a valid session from localStorage, resume it
      if (state.sessionId) {
        // Check if session still exists
        const { data } = await supabase
          .from("study_sessions")
          .select("id, started_at, duration_seconds")
          .eq("id", state.sessionId)
          .single();
        if (data && isSameLocalDay(data.started_at)) {
          state.startedAt = data.started_at;
          state.elapsed = Math.max(state.elapsed, data.duration_seconds || 0);
          state.lastTick = Date.now();
          state.userId = user.id;
          saveState(state);
          notifyTimerUpdated(state);
          return; // session still valid for today
        }
      }

      // Create new session
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({ user_id: user.id, duration_seconds: 0 })
        .select("id, started_at")
        .single();
      if (!error && data) {
        state.sessionId = data.id;
        state.elapsed = 0;
        state.lastActive = Date.now();
        state.lastTick = Date.now();
        state.startedAt = data.started_at;
        state.userId = user.id;
        saveState(state);
        notifyTimerUpdated(state);
      }
    };

    initSession();

    // Activity listeners for inactivity detection
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    activityEvents.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));
    const handleVisibilityChange = () => {
      const now = Date.now();
      state.lastActive = now;
      state.lastTick = now;
      saveState(state);
      notifyTimerUpdated(state);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Tick every INTERVAL_SECONDS
    const interval = setInterval(async () => {
      if (!isSameLocalDay(state.startedAt)) {
        resetForNewSession();
        await initSession();
        return;
      }
      if (!state.sessionId) return;

      const now = Date.now();
      if (document.hidden) {
        state.lastTick = now;
        saveState(state);
        return; // Conta plataforma aberta/visível, sem acumular quando a aba está em segundo plano
      }

      const delta = Math.max(0, Math.min(INTERVAL_SECONDS, Math.floor((now - state.lastTick) / 1000) || INTERVAL_SECONDS));
      state.elapsed += delta;
      state.lastTick = now;
      saveState(state);
      notifyTimerUpdated(state);

      await supabase
        .from("study_sessions")
        .update({ duration_seconds: state.elapsed })
        .eq("id", state.sessionId);
    }, INTERVAL_SECONDS * 1000);

    // Save on page unload
    const handleUnload = () => {
      if (!state.sessionId) return;
      const now = Date.now();
      if (!document.hidden) {
        state.elapsed += Math.max(0, Math.min(INTERVAL_SECONDS, Math.floor((now - state.lastTick) / 1000)));
        state.lastTick = now;
      }
      saveState(state);
      notifyTimerUpdated(state);
      // Use sendBeacon with proper auth headers via Blob
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions?id=eq.${state.sessionId}`;
      const body = JSON.stringify({ duration_seconds: state.elapsed });
      const headers = {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        "Authorization": `Bearer ${(JSON.parse(localStorage.getItem("sb-axsnwyyraybgczmsntur-auth-token") || "{}"))?.access_token || ""}`,
        "Prefer": "return=minimal",
      };
      // sendBeacon only supports Blob/FormData for custom headers via fetch keepalive
      try {
        fetch(url, {
          method: "PATCH",
          headers,
          body,
          keepalive: true,
        });
      } catch {
        // Fallback: best-effort save already persisted to localStorage
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      activityEvents.forEach(evt => window.removeEventListener(evt, markActive));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
