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

// Cache helpers
const SUBSCRIPTION_CACHE_KEY = "choa_sub_cache";

function getCachedSubscription(userId: string) {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Only use cache if same user and less than 5 minutes old
    if (cached.userId === userId && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached;
    }
  } catch {}
  return null;
}

function setCachedSubscription(userId: string, subscribed: boolean, subscriptionEnd: string | null) {
  try {
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({
      userId,
      subscribed,
      subscriptionEnd,
      timestamp: Date.now(),
    }));
  } catch {}
}

function clearCachedSubscription() {
  try { localStorage.removeItem(SUBSCRIPTION_CACHE_KEY); } catch {}
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

  // Deduplication: prevent multiple concurrent subscription checks
  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const lastCheckedUserRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("nome, cpf")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const checkSubscription = useCallback(async () => {
    // If there's already a check in flight, reuse it
    if (checkInFlightRef.current) {
      return checkInFlightRef.current;
    }

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) {
          console.error("Error checking subscription:", error);
          setSubscribed(false);
          setSubscriptionEnd(null);
        } else {
          const sub = data?.subscribed ?? false;
          const end = data?.subscription_end ?? null;
          setSubscribed(sub);
          setSubscriptionEnd(end);
          // Cache the result
          const currentUser = (await supabase.auth.getUser()).data.user;
          if (currentUser) {
            setCachedSubscription(currentUser.id, sub, end);
          }
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
        setSubscribed(false);
        setSubscriptionEnd(null);
      } finally {
        setSubscriptionLoading(false);
        checkInFlightRef.current = null;
      }
    })();

    checkInFlightRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Use cache for instant feedback while Edge Function loads
        const cached = getCachedSubscription(session.user.id);
        if (cached) {
          setSubscribed(cached.subscribed);
          setSubscriptionEnd(cached.subscriptionEnd);
          // Still mark as loading so the fresh check runs, but don't block UI
          setSubscriptionLoading(false);
        }
      } else {
        setSubscriptionLoading(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use cache immediately to avoid blocking
          const cached = getCachedSubscription(session.user.id);
          if (cached) {
            setSubscribed(cached.subscribed);
            setSubscriptionEnd(cached.subscriptionEnd);
          }
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setSubscribed(false);
          setSubscriptionEnd(null);
          setSubscriptionLoading(false);
          clearCachedSubscription();
        }

        // Handle expired refresh tokens
        if (event === "TOKEN_REFRESHED" && !session) {
          clearCachedSubscription();
          supabase.auth.signOut();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check admin role and subscription when user changes
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setSubscriptionLoading(false);
      return;
    }

    // Skip if we already checked this user (prevents duplicate calls)
    if (lastCheckedUserRef.current === user.id) return;
    lastCheckedUserRef.current = user.id;

    // Check admin role from user_roles table
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        const admin = (data && data.length > 0) || false;
        setIsAdmin(admin);
        if (admin) {
          setSubscribed(true);
          setSubscriptionLoading(false);
          setCachedSubscription(user.id, true, null);
        } else {
          // Only call if no cache (otherwise we already set subscriptionLoading=false)
          const cached = getCachedSubscription(user.id);
          if (!cached) {
            setSubscriptionLoading(true);
          }
          checkSubscription();
        }
      });
  }, [user, checkSubscription]);

  // Auto-refresh subscription every 60 seconds (skip for admins)
  useEffect(() => {
    if (!user || isAdmin) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, isAdmin, checkSubscription]);

  const signOut = async () => {
    clearCachedSubscription();
    lastCheckedUserRef.current = null;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscribed(false);
    setSubscriptionEnd(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, subscribed, subscriptionEnd, subscriptionLoading, isAdmin, checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
