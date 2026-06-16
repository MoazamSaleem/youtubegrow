import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionPlan } from "@/lib/planLimits";
import { selectBestSubscription } from "@/lib/subscription";

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  billing_cycle: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string;
  updated_at?: string | null;
  created_at?: string | null;
}

interface CheckSubscriptionResponse {
  subscribed?: boolean;
  plan?: SubscriptionPlan | null;
  subscription_end?: string | null;
  status?: string | null;
  billing_cycle?: string | null;
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

const shouldSyncSubscription = (subscription?: Subscription | null) => {
  return (
    !subscription ||
    subscription.status === "pending" ||
    subscription.status === "inactive" ||
    subscription.status === "expired"
  );
};

const mergeSubscriptions = (
  ...subscriptions: Array<Subscription | null | undefined>
) => {
  return selectBestSubscription(
    subscriptions.filter((subscription): subscription is Subscription => Boolean(subscription))
  );
};

const isNetworkAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: string }).message?.toLowerCase() ?? "";
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("err_name_not_resolved") ||
    message.includes("load failed")
  );
};

const isInvalidRefreshTokenError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: string }).message?.toLowerCase() ?? "";
  return message.includes("invalid refresh token") || message.includes("refresh token not found");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<Subscription | null> | null>(null);
  const pendingSyncAttempted = useRef<string | null>(null);
  const authInitialized = useRef(false);
  const lastResolvedUserId = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const currentLoadingRef = useRef(true);

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    currentLoadingRef.current = loading;
  }, [loading]);

  const clearAuthState = useCallback(() => {
    pendingSyncAttempted.current = null;
    lastResolvedUserId.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setIsAdmin(false);
  }, []);

  const validateSession = useCallback(async (candidate: Session | null) => {
    if (!candidate?.access_token) return null;

    const { data, error } = await supabase.auth.getUser(candidate.access_token);
    if (error) {
      if (isNetworkAuthError(error)) {
        console.warn("Unable to validate auth session because the auth server is unreachable:", error.message);
        return candidate;
      }
      console.warn("Rejected invalid auth session:", error?.message ?? "Unknown auth error");
      return null;
    }
    if (!data.user) {
      console.warn("Rejected invalid auth session: user payload missing");
      return null;
    }

    return candidate;
  }, []);

  const getSessionWithRefresh = useCallback(async (forceRefresh = false) => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn("Unable to read auth session:", sessionError.message);
      return null;
    }

    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!forceRefresh && !shouldRefresh) {
        const validatedSession = await validateSession(session);
        if (validatedSession) return validatedSession;
      }
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      if (isInvalidRefreshTokenError(refreshError)) {
        clearAuthState();
        await supabase.auth.signOut({ scope: "local" });
      }
      console.warn("Auth session refresh failed:", refreshError.message);
      return null;
    }
    if (refreshed.session?.access_token) {
      const validatedSession = await validateSession(refreshed.session);
      if (validatedSession) return validatedSession;
    }

    return null;
  }, [clearAuthState, validateSession]);

  const fetchSubscriptionFromDb = useCallback(async (userId: string) => {
    const { data: subscriptionRows, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (subscriptionError) {
      console.error("Error fetching subscription:", subscriptionError);
      return null;
    }

    return selectBestSubscription((subscriptionRows ?? []) as Subscription[]);
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [{ data: profileData }, resolvedSubscription, { data: roleData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        fetchSubscriptionFromDb(userId),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

      setProfile((profileData as Profile | null) ?? null);
      setSubscription(resolvedSubscription);
      setIsAdmin(!!roleData);

      return resolvedSubscription;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }, [fetchSubscriptionFromDb]);

  const refreshSubscriptionForUser = useCallback(async (
    userId: string,
    existingSubscription?: Subscription | null
  ) => {
    if (refreshInFlight.current) {
      return await refreshInFlight.current;
    }

    const run = (async () => {
      let syncedSubscription: Subscription | null = null;

      try {
        const activeSession = await getSessionWithRefresh();
        // First check Stripe and sync server-side subscription
        const { data: stripeData, error } = await supabase.functions.invoke<CheckSubscriptionResponse>("check-subscription", {
          headers: activeSession?.access_token
            ? {
                Authorization: `Bearer ${activeSession.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              }
            : undefined,
        });
        if (!error && stripeData?.subscribed && stripeData.plan && stripeData.subscription_end) {
          syncedSubscription = {
            id: "stripe-sync",
            plan: stripeData.plan,
            billing_cycle: stripeData.billing_cycle ?? "monthly",
            status: stripeData.status ?? "active",
            trial_ends_at: stripeData.status === "trialing" ? stripeData.subscription_end : null,
            current_period_end: stripeData.subscription_end,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          setSubscription((previous) =>
            mergeSubscriptions(
              previous,
              existingSubscription,
              {
                ...syncedSubscription!,
                id: previous?.id ?? existingSubscription?.id ?? syncedSubscription!.id,
                billing_cycle:
                  stripeData.billing_cycle ??
                  previous?.billing_cycle ??
                  existingSubscription?.billing_cycle ??
                  syncedSubscription!.billing_cycle,
                trial_ends_at:
                  stripeData.status === "trialing"
                    ? stripeData.subscription_end
                    : previous?.trial_ends_at ??
                      existingSubscription?.trial_ends_at ??
                      syncedSubscription!.trial_ends_at,
                created_at:
                  previous?.created_at ??
                  existingSubscription?.created_at ??
                  syncedSubscription!.created_at,
              }
            )
          );
        }
        if (error) {
          console.warn("Subscription check failed, falling back:", error.message ?? error);
        }
      } catch (error) {
        console.warn("Subscription check failed, falling back:", error);
      }

      const dbSubscription = await fetchSubscriptionFromDb(userId);
      const resolvedSubscription = mergeSubscriptions(
        dbSubscription,
        syncedSubscription,
        existingSubscription
      );
      setSubscription(resolvedSubscription);

      return resolvedSubscription;
    })().finally(() => {
      refreshInFlight.current = null;
    });

    refreshInFlight.current = run;
    return await run;
  }, [fetchSubscriptionFromDb, getSessionWithRefresh]);

  const hydrateUserSession = useCallback(async (nextSession: Session | null, silent = false) => {
    setSession(nextSession);

    if (!nextSession?.access_token) {
      clearAuthState();
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser(nextSession.access_token);
      if (error) {
        if (isNetworkAuthError(error)) {
          console.warn("Unable to hydrate auth session because the auth server is unreachable:", error.message);
          setUser(nextSession.user ?? null);
          return;
        }
        console.warn("Invalid auth session detected:", error.message);
        clearAuthState();
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      const authUser = data.user ?? nextSession.user ?? null;
      setUser(authUser);

      if (!authUser) {
        clearAuthState();
        return;
      }

      if (lastResolvedUserId.current !== authUser.id) {
        pendingSyncAttempted.current = null;
      }
      lastResolvedUserId.current = authUser.id;

      const resolvedSubscription = await fetchUserData(authUser.id);
      if (
        shouldSyncSubscription(resolvedSubscription) &&
        pendingSyncAttempted.current !== authUser.id
      ) {
        pendingSyncAttempted.current = authUser.id;
        await refreshSubscriptionForUser(authUser.id, resolvedSubscription);
      }
    } finally {
      if (!silent || currentLoadingRef.current) {
        setLoading(false);
      }
    }
  }, [clearAuthState, fetchUserData, refreshSubscriptionForUser]);

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        authInitialized.current = true;

        if (event === "TOKEN_REFRESHED") {
          setSession(nextSession);
          setUser((currentUser) => {
            if (!nextSession?.user) return null;
            return currentUser?.id === nextSession.user.id ? currentUser : nextSession.user;
          });
          if (!nextSession?.user) {
            clearAuthState();
          }
          setLoading(false);
          return;
        }

        const sameUserSession =
          !!nextSession?.user?.id &&
          currentUserIdRef.current === nextSession.user.id;
        const shouldHydrateSilently =
          authInitialized.current &&
          !currentLoadingRef.current &&
          event !== "SIGNED_OUT" &&
          sameUserSession;

        if (!shouldHydrateSilently) {
          setLoading(true);
        }
        void hydrateUserSession(nextSession, shouldHydrateSilently);
      }
    );

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (authInitialized.current) return;
      authInitialized.current = true;
      setLoading(true);
      void hydrateUserSession(nextSession);
    });

    return () => authSubscription.unsubscribe();
  }, [clearAuthState, hydrateUserSession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/signin?confirm=1&redirect=${encodeURIComponent("/dashboard/billing")}`;
    
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
    clearAuthState();
  };

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    await refreshSubscriptionForUser(user.id, subscription);
  }, [refreshSubscriptionForUser, subscription, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (pendingSyncAttempted.current === user.id) return;
    const shouldRefresh = shouldSyncSubscription(subscription);

    if (!shouldRefresh) return;

    pendingSyncAttempted.current = user.id;
    void refreshSubscription();
  }, [loading, user, subscription, refreshSubscription]);

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
