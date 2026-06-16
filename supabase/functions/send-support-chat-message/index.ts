import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SessionRow = {
  id: string;
  user_id: string;
};

type MessageRow = {
  id: string;
  created_at: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const senderUser = userData.user;
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!sessionId || !content) {
      return new Response(JSON.stringify({ error: "sessionId and content are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", senderUser.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    const { data: session, error: sessionError } = await adminClient
      .from("support_chat_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .maybeSingle<SessionRow>();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Chat session not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (!isAdmin && session.user_id !== senderUser.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const sender = isAdmin ? "agent" : "user";
    const recipientSender = isAdmin ? "user" : "agent";

    const { data: insertedMessage, error: insertError } = await adminClient
      .from("support_chat_messages")
      .insert({
        session_id: sessionId,
        sender,
        content,
      })
      .select("id, session_id, sender, content, created_at")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const inactiveMinutes = Number(Deno.env.get("SUPPORT_CHAT_INACTIVE_MINUTES") ?? "15");
    const inactivityWindowMs = Math.max(1, inactiveMinutes) * 60 * 1000;

    const { data: lastRecipientMessage } = await adminClient
      .from("support_chat_messages")
      .select("id, created_at")
      .eq("session_id", sessionId)
      .eq("sender", recipientSender)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<MessageRow>();

    const recipientInactive =
      !lastRecipientMessage ||
      Date.now() - new Date(lastRecipientMessage.created_at).getTime() > inactivityWindowMs;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const fromEmail = Deno.env.get("SUPPORT_FROM_EMAIL") || "YouTube Growth Planner <noreply@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") || "https://ytgrowth.cloud";

    const sentTo: string[] = [];
    const emailErrors: string[] = [];

    if (resend && recipientInactive) {
      if (!isAdmin) {
        const { data: adminRoles } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        const adminIds = Array.from(new Set((adminRoles || []).map((r: { user_id: string }) => r.user_id)));
        if (adminIds.length > 0) {
          const { data: adminProfiles } = await adminClient
            .from("profiles")
            .select("email")
            .in("user_id", adminIds);
          const emails = Array.from(
            new Set((adminProfiles || []).map((p: { email: string | null }) => p.email).filter(Boolean) as string[])
          );

          if (emails.length > 0) {
            const { error: sendError } = await resend.emails.send({
              from: fromEmail,
              to: emails,
              subject: "New user live chat message",
              html: `
                <p>A user sent a new live chat message while admin appears inactive.</p>
                <p><strong>Message:</strong> ${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <p><a href="${appUrl}/admin">Open Admin Chat</a></p>
              `,
            });
            if (sendError) emailErrors.push(String(sendError.message ?? sendError));
            else sentTo.push(...emails);
          }
        }
      } else {
        const { data: userProfile } = await adminClient
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", session.user_id)
          .maybeSingle<{ email: string | null; full_name: string | null }>();

        const userEmail = userProfile?.email;
        if (userEmail) {
          const { error: sendError } = await resend.emails.send({
            from: fromEmail,
            to: [userEmail],
            subject: "New reply from support",
            html: `
              <p>${userProfile?.full_name || "Hi"}, support replied to your live chat.</p>
              <p><strong>Message:</strong> ${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              <p><a href="${appUrl}/contact">Open Live Chat</a></p>
            `,
          });
          if (sendError) emailErrors.push(String(sendError.message ?? sendError));
          else sentTo.push(userEmail);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: insertedMessage,
        recipientInactive,
        emailed: sentTo.length > 0,
        recipients: sentTo,
        emailErrors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
