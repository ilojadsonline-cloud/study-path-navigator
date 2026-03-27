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

    if (cached.userId === userId && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached;
    }
  } catch {}

  return null;
}

function setCachedSubscription(userId: string, subscribed: boolean, subscriptionEnd: string | null) {
  try {
    localStorage.setItem(
      SUBSCRIPTION_CACHE_KEY,
      JSON.stringify({
        userId,
        subscribed,
        subscriptionEnd,
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

  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const lastCheckedUserRef = useRef<string | null>(null);

  const resetAuthState = useCallback(() => {
    lastCheckedUserRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscribed(false);
    setSubscriptionEnd(null);
    setSubscriptionLoading(false);
    setIsAdmin(false);
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
          if (cached) {
            setSubscribed(cached.subscribed);
            setSubscriptionEnd(cached.subscriptionEnd);
          }
          return;
        }

        const cached = getCachedSubscription(currentUserId);
        const { data, error } = await supabase.functions.invoke("check-subscription");

        if (error) {
          if (isAuthSessionError(error)) {
            if (cached) {
              setSubscribed(cached.subscribed);
              setSubscriptionEnd(cached.subscriptionEnd);
            }
            return;
          }

          console.error("Error checking subscription:", error);

          if (cached) {
            setSubscribed(cached.subscribed);
            setSubscriptionEnd(cached.subscriptionEnd);
            return;
          }

          setSubscribed(false);
          setSubscriptionEnd(null);
          return;
        }

        const sub = data?.subscribed ?? false;
        const end = data?.subscription_end ?? null;

        setSubscribed(sub);
        setSubscriptionEnd(end);
        setCachedSubscription(currentUserId, sub, end);
      } catch (err) {
        if (isAuthSessionError(err)) {
          if (currentUserId) {
            const cached = getCachedSubscription(currentUserId);
            if (cached) {
              setSubscribed(cached.subscribed);
              setSubscriptionEnd(cached.subscriptionEnd);
            }
          }
          return;
        }

        console.error("Error checking subscription:", err);

        if (currentUserId) {
          const cached = getCachedSubscription(currentUserId);
          if (cached) {
            setSubscribed(cached.subscribed);
            setSubscriptionEnd(cached.subscriptionEnd);
            return;
          }
        }

        setSubscribed(false);
        setSubscriptionEnd(null);
      } finally {
        setSubscriptionLoading(false);
        checkInFlightRef.current = null;
      }
    })();

    checkInFlightRef.current = promise;
    return promise;
  }, [handleExpiredSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const cached = getCachedSubscription(session.user.id);

        if (cached) {
          setSubscribed(cached.subscribed);
          setSubscriptionEnd(cached.subscriptionEnd);
          setSubscriptionLoading(false);
        } else {
          setSubscriptionLoading(true);
        }

        setTimeout(() => {
          void fetchProfile(session.user.id);
        }, 0);
      } else {
        lastCheckedUserRef.current = null;
        setProfile(null);
        setSubscribed(false);
        setSubscriptionEnd(null);
        setSubscriptionLoading(false);
        setIsAdmin(false);
        clearCachedSubscription();
      }

      if (event === "SIGNED_OUT" && !session) {
        resetAuthState();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        void fetchProfile(session.user.id);
        const cached = getCachedSubscription(session.user.id);

        if (cached) {
          setSubscribed(cached.subscribed);
          setSubscriptionEnd(cached.subscriptionEnd);
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
  }, [fetchProfile, resetAuthState]);

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
          setCachedSubscription(user.id, true, null);
          return;
        }

        const cached = getCachedSubscription(user.id);
        if (!cached) {
          setSubscriptionLoading(true);
        }

        void checkSubscription();
      });
  }, [user, checkSubscription]);

  // Re-check subscription every 10 minutes (not 60s) to avoid mid-session disruptions
  useEffect(() => {
    if (!user || isAdmin) return;

    const interval = setInterval(() => {
      void checkSubscription();
    }, 10 * 60_000);

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
        checkSubscription,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}