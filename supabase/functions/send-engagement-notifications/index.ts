import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase    = createClient(supabaseUrl, serviceKey);

// ===========================================================================
// Planning Reminder
// ===========================================================================
const PLANNING_COPY: Record<string, {
  title: string;
  withPeople: (name: string, count: number) => string;
  withoutPeople: (name: string) => string;
}> = {
  morning: {
    title: "Seu plano de hoje de manhã ☀️",
    withPeople:    (name, n) => `${n} ${n === 1 ? "pessoa está" : "pessoas estão"} em ${name} agora. Vai lá!`,
    withoutPeople: (name)    => `Você planejou ir a ${name} de manhã. Ainda vai? ☀️`,
  },
  afternoon: {
    title: "Hoje à tarde — você planejou isso 🌤",
    withPeople:    (name, n) => `${n} ${n === 1 ? "pessoa está" : "pessoas estão"} em ${name} agora. Seu plano é essa tarde!`,
    withoutPeople: (name)    => `Você planejou ir a ${name} essa tarde. Ainda vai? 🌤`,
  },
  evening: {
    title: "Seu plano de hoje à noite 🌙",
    withPeople:    (name, n) => `${n} ${n === 1 ? "pessoa está" : "pessoas estão"} em ${name} agora. Vai cair em cima!`,
    withoutPeople: (name)    => `Você planejou ir a ${name} hoje à noite. Ainda vai? 🌙`,
  },
};

async function handlePlanningReminders(): Promise<number> {
  const { data: candidates, error } = await supabase.rpc("get_planning_reminder_candidates");
  if (error) { console.error("[PlanningReminder] RPC error:", error); return 0; }
  if (!candidates?.length) { console.log("[PlanningReminder] No candidates."); return 0; }

  let sent = 0;
  for (const c of candidates) {
    const copy = PLANNING_COPY[c.planned_period];
    if (!copy) continue;

    const hasActivePeople = c.active_count > 0;
    const result = await sendPushNotification({
      supabase,
      userId:  c.user_id,
      type:    "planning_reminder",
      title:   copy.title,
      body:    hasActivePeople ? copy.withPeople(c.place_name, c.active_count) : copy.withoutPeople(c.place_name),
      placeId: c.place_id,
      data: {
        place_id:          c.place_id,
        place_name:        c.place_name,
        has_active_people: String(hasActivePeople),
      },
    });
    if (result.success && result.sent > 0) sent++;
  }
  return sent;
}

// ===========================================================================
// Weekend Engagement
// ===========================================================================
const WEEKEND_COPY: Record<number, { title: string; body: string }[]> = {
  5: [ // Friday
    { title: "O fim de semana chegou! 🎉",    body: "Veja quem está saindo hoje perto de você 👀" },
    { title: "Finalmente sexta! 🎉",           body: "Tem planos? Descubra o que rola perto de você" },
    { title: "Modo rolê: on 🍻",              body: "Veja quem está saindo hoje na sua cidade" },
  ],
  6: [ // Saturday
    { title: "Sábado é dia de sair de casa! 🌟", body: "Veja quem está por aí hoje" },
    { title: "O sábado perfeito começa com um bom plano 🌅", body: "Que tal descobrir o que rola perto de você?" },
    { title: "Hoje é dia de aproveitar! 🗺",  body: "Descubra o que rola perto de você" },
  ],
  0: [ // Sunday
    { title: "Último dia do fim de semana ☀️", body: "Ainda dá tempo de curtir! Veja o que rola" },
    { title: "Domingo também conta 🌻",        body: "Veja quem está saindo hoje na sua cidade" },
    { title: "Não deixa o domingo passar em branco! 🔥", body: "Descubra o que rola perto de você" },
  ],
};

function weekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / (7 * 864e5));
}

async function handleWeekendEngagement(): Promise<number> {
  const now     = new Date();
  const dow     = now.getUTCDay();
  const variants = WEEKEND_COPY[dow];

  if (!variants) {
    console.log(`[WeekendEngagement] Not a weekend day (DOW=${dow}), skipping.`);
    return 0;
  }

  const { title, body } = variants[weekNumber(now) % 3];
  const { data: candidates, error } = await supabase.rpc("get_weekend_engagement_candidates");
  if (error) { console.error("[WeekendEngagement] RPC error:", error); return 0; }
  if (!candidates?.length) { console.log("[WeekendEngagement] No candidates."); return 0; }

  let sent = 0;
  for (const c of candidates) {
    const result = await sendPushNotification({
      supabase,
      userId: c.user_id,
      type:   "weekend_engagement",
      title,
      body,
      data:   { dow: String(dow) },
    });
    if (result.success && result.sent > 0) sent++;
  }
  return sent;
}

// ===========================================================================
// Entry point — dispatches by type
// ===========================================================================
serve(async (req) => {
  try {
    const { type } = await req.json().catch(() => ({ type: null })) as { type?: string };
    console.log(`[EngagementNotifications] type=${type}`);

    let sent = 0;
    switch (type) {
      case "planning_reminder":
        sent = await handlePlanningReminders();
        break;
      case "weekend_engagement":
        sent = await handleWeekendEngagement();
        break;
      default:
        console.warn(`[EngagementNotifications] Unknown type: ${type}`);
        return new Response(JSON.stringify({ error: "unknown_type" }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, type, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[EngagementNotifications] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
