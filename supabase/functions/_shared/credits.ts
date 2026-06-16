import { createClient } from "npm:@supabase/supabase-js@2";

// Credit costs for different query types
export const CREDIT_COSTS = {
  "ai-chat": { basic: 20, standard: 50, extensive: 100 },
  "generate-topics": { basic: 20, standard: 20, extensive: 20 },
  "generate-script": { basic: 50, standard: 50, extensive: 50 },
  "generate-speech": { basic: 80, standard: 120, extensive: 180 },
  "generate-video": { basic: 80, standard: 80, extensive: 80 },
  "research-keywords": { basic: 20, standard: 20, extensive: 20 },
  "analyze-competitor": { basic: 50, standard: 50, extensive: 50 },
  "analyze-channel": { basic: 100, standard: 100, extensive: 100 },
  "generate-thumbnail": { basic: 100, standard: 100, extensive: 100 },
  "analyze-seo-video": { basic: 20, standard: 20, extensive: 20 },
};

export type QueryType = keyof typeof CREDIT_COSTS;
export type QueryComplexity = "basic" | "standard" | "extensive";

interface CreditCheckResult {
  success: boolean;
  error?: string;
  currentBalance?: number;
  cost?: number;
}

interface DeductCreditsResult {
  success: boolean;
  new_balance: number;
  current_balance: number;
}

export async function checkAndDeductCredits(
  userId: string,
  queryType: QueryType,
  complexity: QueryComplexity = "standard"
): Promise<CreditCheckResult> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const cost = CREDIT_COSTS[queryType]?.[complexity] || 20;
  console.log(`[CREDITS] Checking credits for user ${userId}, type: ${queryType}, complexity: ${complexity}, cost: ${cost}`);

  try {
    // Use atomic database function to prevent race conditions
    const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: cost
    });

    if (error) {
      console.error("[CREDITS] Error calling deduct_credits:", error);
      return { success: false, error: "Failed to deduct credits" };
    }

    const result = (data as DeductCreditsResult[] | null)?.[0];
    
    if (!result || !result.success) {
      const currentBalance = result?.current_balance || 0;
      console.log(`[CREDITS] Insufficient credits. Balance: ${currentBalance}, required: ${cost}`);
      return { 
        success: false, 
        error: `Insufficient credits. You have ${currentBalance} credits, but this action requires ${cost} credits.`,
        currentBalance,
        cost
      };
    }

    const newBalance = result.new_balance;
    console.log(`[CREDITS] Deducted ${cost} credits atomically. New balance: ${newBalance}`);

    // Log to ai_credits_usage
    await supabaseAdmin.from("ai_credits_usage").insert({
      user_id: userId,
      credits_used: cost,
      query_type: queryType,
      query_complexity: complexity,
    });

    // Log to credits_history
    await supabaseAdmin.from("credits_history").insert({
      user_id: userId,
      amount: -cost,
      type: "usage",
      description: `${queryType.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())} - ${complexity}`,
      balance_after: newBalance,
    });

    return { success: true, currentBalance: newBalance, cost };
  } catch (error) {
    console.error("[CREDITS] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { data: tokenData } = await supabaseAdmin
      .from("user_tokens")
      .select("ai_credits_balance")
      .eq("user_id", userId)
      .maybeSingle();

    const currentBalance = tokenData?.ai_credits_balance || 0;
    const newBalance = currentBalance + amount;

    await supabaseAdmin
      .from("user_tokens")
      .update({
        ai_credits_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await supabaseAdmin.from("credits_history").insert({
      user_id: userId,
      amount: amount,
      type: "refund",
      description: reason,
      balance_after: newBalance,
    });

    console.log(`[CREDITS] Refunded ${amount} credits. New balance: ${newBalance}`);
    return true;
  } catch (error) {
    console.error("[CREDITS] Refund error:", error);
    return false;
  }
}

export async function deductCreditsWithAmount(
  userId: string,
  amount: number,
  queryType: QueryType,
  description: string,
  complexity: QueryComplexity = "standard"
): Promise<CreditCheckResult> {
  if (amount <= 0) {
    return { success: true, cost: 0 };
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount
    });

    if (error) {
      console.error("[CREDITS] Error calling deduct_credits:", error);
      return { success: false, error: "Failed to deduct credits" };
    }

    const result = (data as DeductCreditsResult[] | null)?.[0];
    if (!result || !result.success) {
      const currentBalance = result?.current_balance || 0;
      return {
        success: false,
        error: `Insufficient credits. You have ${currentBalance} credits, but this action requires ${amount} credits.`,
        currentBalance,
        cost: amount
      };
    }

    await supabaseAdmin.from("ai_credits_usage").insert({
      user_id: userId,
      credits_used: amount,
      query_type: queryType,
      query_complexity: complexity,
    });

    await supabaseAdmin.from("credits_history").insert({
      user_id: userId,
      amount: -amount,
      type: "usage",
      description: description,
      balance_after: result.new_balance,
    });

    return { success: true, currentBalance: result.new_balance, cost: amount };
  } catch (error) {
    console.error("[CREDITS] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
