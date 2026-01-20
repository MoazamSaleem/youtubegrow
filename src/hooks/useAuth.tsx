import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SubscriptionPlan = "free" | "basic" | "pro" | "advanced";

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  billing_cycle: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string;
}

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const pendingSyncAttempted = useRef<string | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch subscription
      const { data: subscriptionData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (subscriptionData) {
        setSubscription(subscriptionData as Subscription);
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!roleData);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        pendingSyncAttempted.current = null;

        // Defer data fetching with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setIsAdmin(false);
  };

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }

    const run = (async () => {
      try {
        // First check Stripe and sync server-side subscription
        const { data: stripeData, error } = await supabase.functions.invoke("check-subscription");
        if (!error && stripeData) {
          // The check-subscription function syncs the subscription in DB, so fetch the updated local data
          console.log("[useAuth] check-subscription returned:", stripeData);
        }
        if (error) {
          console.warn("Subscription check failed, falling back:", error.message ?? error);
        }
      } catch (error) {
        console.warn("Subscription check failed, falling back:", error);
      }

      // Always fetch the latest subscription data from DB (which was synced by check-subscription)
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSubscription(data as Subscription);
      }
    })().finally(() => {
      refreshInFlight.current = null;
    });

    refreshInFlight.current = run;
    await run;
  }, [user]);

  useEffect(() => {
    if (!user || !subscription) return;
    if (pendingSyncAttempted.current === user.id) return;
    if (subscription.plan === "free") return;
    if (subscription.status === "active" || subscription.status === "trialing") return;

    pendingSyncAttempted.current = user.id;
    refreshSubscription();
  }, [user, subscription, refreshSubscription]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        subscription,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
