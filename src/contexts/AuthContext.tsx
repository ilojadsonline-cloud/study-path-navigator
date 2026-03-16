import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("nome, cpf")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("Error checking subscription:", error);
        setSubscribed(false);
        setSubscriptionEnd(null);
      } else {
        setSubscribed(data?.subscribed ?? false);
        setSubscriptionEnd(data?.subscription_end ?? null);
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
      setSubscribed(false);
      setSubscriptionEnd(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Keep subscriptionLoading true until the user effect handles it
        setSubscriptionLoading(true);
      } else {
        setSubscriptionLoading(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Set subscriptionLoading synchronously to prevent race condition
          // where ProtectedRoute sees user but subscriptionLoading=false
          setSubscriptionLoading(true);
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setSubscribed(false);
          setSubscriptionEnd(null);
          setSubscriptionLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check admin role and subscription when user is available
  useEffect(() => {
    if (user) {
      setSubscriptionLoading(true);
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
            // Admin bypasses subscription check
            setSubscribed(true);
            setSubscriptionLoading(false);
          } else {
            checkSubscription();
          }
        });
    } else {
      setIsAdmin(false);
      setSubscriptionLoading(false);
    }
  }, [user, checkSubscription]);

  // Auto-refresh subscription every 60 seconds (skip for admins)
  useEffect(() => {
    if (!user || isAdmin) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, isAdmin, checkSubscription]);

  const signOut = async () => {
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
