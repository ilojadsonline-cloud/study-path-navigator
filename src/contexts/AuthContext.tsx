import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  nome: string;
  cpf: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  subscribed: boolean;
  subscriptionEnd: string | null;
  subscriptionLoading: boolean;
  isAdmin: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialExpired: boolean;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  subscribed: false,
  subscriptionEnd: null,
  subscriptionLoading: true,
  isAdmin: false,
  isTrial: false,
  trialEndsAt: null,
  trialExpired: false,
  checkSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const SUBSCRIPTION_CACHE_KEY = "choa_sub_cache";

function getCachedSubscription(userId: string) {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);

    if (cached.userId === userId && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      return cached;
    }
  } catch {}

  return null;
}

function setCachedSubscription(
  userId: string,
  subscribed: boolean,
  subscriptionEnd: string | null,
  isTrial: boolean = false,
  trialEndsAt: string | null = null,
  trialExpired: boolean = false,
) {
  try {
    localStorage.setItem(
      SUBSCRIPTION_CACHE_KEY,
      JSON.stringify({
        userId,
        subscribed,
        subscriptionEnd,
        isTrial,
        trialEndsAt,
        trialExpired,
        timestamp: Date.now(),
      }),
    );
  } catch {}
}

function clearCachedSubscription() {
  try {
    localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
  } catch {}
}

function hasUsablePaidCache(cached: any) {
  return Boolean(cached?.subscribed && cached?.isTrial !== true && cached?.trialExpired !== true);
}

function isAuthSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /auth session missing|session not found|refresh token|jwt|authorization/i.test(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);

  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const lastCheckedUserRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null>(null);

  const resetAuthState = useCallback(() => {
    lastCheckedUserRef.current = null;
    authUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscribed(false);
    setSubscriptionEnd(null);
    setSubscriptionLoading(false);
    setIsAdmin(false);
    setIsTrial(false);
    setTrialEndsAt(null);
    setTrialExpired(false);
    clearCachedSubscription();
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("nome, cpf")
      .eq("user_id", userId)
      .single();

    setProfile(data);
  }, []);

  const signOut = useCallback(async () => {
    resetAuthState();
    await supabase.auth.signOut();
  }, [resetAuthState]);

  const handleExpiredSession = useCallback(async () => {
    console.warn("Sessão inválida/expirada detectada durante validação da assinatura.");
    await signOut();
  }, [signOut]);

  const applySubState = useCallback((sub: boolean, end: string | null, trial: boolean = false, trialEnd: string | null = null, expired: boolean = false) => {
    setSubscribed(sub);
    setSubscriptionEnd(end);
    setIsTrial(trial);
    setTrialEndsAt(trialEnd);
    setTrialExpired(expired && !sub);
  }, []);

  const checkSubscription = useCallback(async () => {
    if (checkInFlightRef.current) {
      return checkInFlightRef.current;
    }

    const promise = (async () => {
      let currentUserId: string | null = null;

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        currentUserId = currentSession?.user?.id ?? null;

        if (!currentSession?.access_token || !currentUserId) {
          const cached = user ? getCachedSubscription(user.id) : null;
          if (hasUsablePaidCache(cached)) {
            applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
          }
          return;
        }

        const cached = getCachedSubscription(currentUserId);
        const { data, error } = await supabase.functions.invoke("check-subscription");

        if (error) {
          if (isAuthSessionError(error)) {
            if (hasUsablePaidCache(cached)) {
              applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
            }
            return;
          }

          console.error("Error checking subscription:", error);

          if (hasUsablePaidCache(cached)) {
            applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
            return;
          }

          applySubState(false, null);
          return;
        }

        const sub = data?.subscribed ?? false;
        const end = data?.subscription_end ?? null;
        const trial = data?.is_trial ?? false;
        const trialEnd = data?.trial_ends_at ?? null;
        const expired = data?.trial_expired === true;

        applySubState(sub, end, trial, trialEnd, expired);
        setCachedSubscription(currentUserId, sub, end, trial, trialEnd, expired);
      } catch (err) {
        if (isAuthSessionError(err)) {
          if (currentUserId) {
            const cached = getCachedSubscription(currentUserId);
            if (hasUsablePaidCache(cached)) {
              applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
            }
          }
          return;
        }

        console.error("Error checking subscription:", err);

        if (currentUserId) {
          const cached = getCachedSubscription(currentUserId);
          if (hasUsablePaidCache(cached)) {
            applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
            return;
          }
        }

        applySubState(false, null);
      } finally {
        setSubscriptionLoading(false);
        checkInFlightRef.current = null;
      }
    })();

    checkInFlightRef.current = promise;
    return promise;
  }, [handleExpiredSession, applySubState]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const incomingUserId = session?.user?.id ?? null;
      const isSameSignedInUser = Boolean(incomingUserId && incomingUserId === authUserIdRef.current);

      if (!incomingUserId && authUserIdRef.current && event !== "SIGNED_OUT") {
        return;
      }

      // Ignore transient events that fire when the tab regains focus or tokens
      // auto-refresh. Supabase can emit SIGNED_IN again for an existing session;
      // re-running profile/subscription checks there remounts protected pages.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || (event === "SIGNED_IN" && isSameSignedInUser)) {
        return;
      }

      authUserIdRef.current = incomingUserId;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const cached = getCachedSubscription(session.user.id);

        if (event === "SIGNED_IN") {
          if (hasUsablePaidCache(cached)) {
            applySubState(true, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
            setSubscriptionLoading(false);
          } else {
            setSubscriptionLoading(true);
          }
        } else if (hasUsablePaidCache(cached)) {
          applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
          setSubscriptionLoading(false);
        }

        setTimeout(() => {
          void fetchProfile(session.user.id);
        }, 0);
      } else {
        lastCheckedUserRef.current = null;
        setProfile(null);
        applySubState(false, null);
        setSubscriptionLoading(false);
        setIsAdmin(false);
        clearCachedSubscription();
      }

      if (event === "SIGNED_OUT" && !session) {
        resetAuthState();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      authUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        void fetchProfile(session.user.id);
        const cached = getCachedSubscription(session.user.id);

        if (hasUsablePaidCache(cached)) {
          applySubState(cached.subscribed, cached.subscriptionEnd, cached.isTrial ?? false, cached.trialEndsAt ?? null, cached.trialExpired ?? false);
          setSubscriptionLoading(false);
        } else {
          setSubscriptionLoading(true);
        }
      } else {
        lastCheckedUserRef.current = null;
        setSubscriptionLoading(false);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, resetAuthState, applySubState]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setSubscriptionLoading(false);
      return;
    }

    if (lastCheckedUserRef.current === user.id) return;
    lastCheckedUserRef.current = user.id;

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error checking admin role:", error);
        }

        const admin = (data && data.length > 0) || false;
        setIsAdmin(admin);

        if (admin) {
          setSubscribed(true);
          setSubscriptionEnd(null);
          setSubscriptionLoading(false);
          setTrialExpired(false);
          setCachedSubscription(user.id, true, null, false, null, false);
          return;
        }

        const cached = getCachedSubscription(user.id);
        if (!cached) {
          if (!lastCheckedUserRef.current) {
            setSubscriptionLoading(true);
          }
        }

        void checkSubscription();
      });
  }, [user, checkSubscription]);

  // Update last_seen_at for online presence tracking
  useEffect(() => {
    if (!user) return;

    const updatePresence = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .then(() => {});
    };

    updatePresence();
    const interval = setInterval(updatePresence, 2 * 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // Re-check subscription every 30 minutes in background.
  // Never toggles subscriptionLoading so ProtectedRoute does not unmount
  // the current page and lose in-progress work (e.g. questions/simulado state).
  useEffect(() => {
    if (!user || isAdmin) return;

    const interval = setInterval(() => {
      void checkSubscription();
    }, 30 * 60_000);

    return () => clearInterval(interval);
  }, [user, isAdmin, checkSubscription]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        subscribed,
        subscriptionEnd,
        subscriptionLoading,
        isAdmin,
        isTrial,
        trialEndsAt,
        trialExpired,
        checkSubscription,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
