import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERMANENT_BAN_HOURS = 87600; // 10 years

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Server not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return json({ error: "Invalid user session" }, 401);
    }

    const body = await req.json();
    const action = body?.action;

    if (!action) {
      return json({ error: "Missing action" }, 400);
    }

    const userId = userData.user.id;
    const targetUserId =
      typeof body?.targetUserId === "string" && body.targetUserId.trim().length > 0
        ? body.targetUserId.trim()
        : userId;

    const { data: adminRoles, error: adminRoleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);

    if (adminRoleError) {
      return json({ error: adminRoleError.message, step: "load-admin-role" }, 500);
    }

    const isAdmin = (adminRoles?.length ?? 0) > 0;

    if (action === "deactivate-temporary") {
      const durationHours = Number(body?.durationHours);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return json({ error: "Invalid durationHours" }, 400);
      }

      if (targetUserId !== userId && !isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
        ban_duration: `${Math.round(durationHours)}h`,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "deactivate-permanent") {
      if (targetUserId !== userId && !isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
        ban_duration: `${PERMANENT_BAN_HOURS}h`,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "reactivate") {
      if (targetUserId !== userId && !isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete-account") {
      if (targetUserId !== userId && !isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const { error } = await supabase.auth.admin.deleteUser(targetUserId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "admin-update-user") {
      if (!isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!targetUserId) {
        return json({ error: "Missing targetUserId" }, 400);
      }

      if (!email) {
        return json({ error: "Email is required" }, 400);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName || null })
        .eq("user_id", targetUserId);

      if (profileError) {
        return json({ error: profileError.message, step: "update-profile" }, 500);
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetUserId, {
        email,
        user_metadata: {
          full_name: fullName || null,
        },
      });

      if (authUpdateError) {
        return json({ error: authUpdateError.message, step: "update-auth-user" }, 500);
      }

      return json({ success: true });
    }

    if (action === "admin-list-users") {
      if (!isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }

      const search = typeof body?.search === "string" ? body.search.trim().toLowerCase() : "";
      const planFilter = typeof body?.planFilter === "string" ? body.planFilter : "all";
      const page = Math.max(1, Number(body?.page) || 1);
      const perPage = Math.max(1, Math.min(100, Number(body?.perPage) || 10));

      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      const authUsers = listError ? [] : listData?.users || [];
      const listUsersFailed = !!listError;
      const userIds = authUsers.map((u) => u.id);

      const { data: profiles, error: profilesError } = (userIds.length && !listUsersFailed)
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, created_at")
            .in("user_id", userIds)
        : await supabase
            .from("profiles")
            .select("user_id, full_name, created_at");
      if (profilesError) return json({ error: profilesError.message, step: "profiles" }, 500);

      const resolvedUserIds = listUsersFailed
        ? (profiles || []).map((p: any) => p.user_id)
        : userIds;

      const { data: subscriptions, error: subscriptionsError } = resolvedUserIds.length
        ? await supabase
            .from("subscriptions")
            .select("user_id, plan, status, updated_at, created_at")
            .in("user_id", resolvedUserIds)
        : { data: [], error: null };
      if (subscriptionsError) return json({ error: subscriptionsError.message, step: "subscriptions" }, 500);

      const profileByUserId = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileByUserId.set(p.user_id, p));

      const subByUser: Record<string, any[]> = {};
      (subscriptions || []).forEach((sub: any) => {
        if (!subByUser[sub.user_id]) subByUser[sub.user_id] = [];
        subByUser[sub.user_id].push(sub);
      });

      const scoreStatus = (status?: string | null) =>
        status === "active" ? 3 : status === "trialing" ? 2 : status === "pending" ? 1 : 0;

      const rowsFromAuth = authUsers.map((authUser) => {
        const profile = profileByUserId.get(authUser.id);
        const subs = subByUser[authUser.id] || [];
        const bestSub = [...subs].sort((a, b) => scoreStatus(b.status) - scoreStatus(a.status))[0];

        return {
          id: authUser.id,
          email: authUser.email || "",
          full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
          created_at: profile?.created_at || authUser.created_at,
          plan: bestSub?.plan || null,
          status: bestSub?.status || "inactive",
        };
      });

      const rowsFromProfiles = (profiles || []).map((profile: any) => {
        const subs = subByUser[profile.user_id] || [];
        const bestSub = [...subs].sort((a, b) => scoreStatus(b.status) - scoreStatus(a.status))[0];
        return {
          id: profile.user_id,
          email: "",
          full_name: profile.full_name || null,
          created_at: profile.created_at,
          plan: bestSub?.plan || null,
          status: bestSub?.status || "inactive",
        };
      });

      const rows = listUsersFailed ? rowsFromProfiles : rowsFromAuth;

      const searched = search
        ? rows.filter((u) =>
            String(u.email || "").toLowerCase().includes(search) ||
            String(u.full_name || "").toLowerCase().includes(search)
          )
        : rows;

      const filtered =
        planFilter === "all"
          ? searched
          : planFilter === "active"
            ? searched.filter((u) => u.status === "active" || u.status === "trialing")
          : planFilter === "none"
            ? searched.filter((u) => !u.plan)
            : searched.filter((u) => u.plan === planFilter);

      const sorted = [...filtered].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime() || 0;
        const tb = new Date(b.created_at || 0).getTime() || 0;
        return tb - ta;
      });

      const total = sorted.length;
      const start = (page - 1) * perPage;
      const users = sorted.slice(start, start + perPage);

      return json({
        users,
        total,
        source: listUsersFailed ? "profiles-fallback" : "auth-admin",
        listUsersError: listError?.message ?? null,
      });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error", step: "top-level" },
      500
    );
  }
});
