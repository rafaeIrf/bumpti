import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { FCMPayload, generateFCMToken, sendFCMMessage } from "./fcm.ts";

export type NotificationType = "message_received" | "match_created" | "favorite_activity_started" | "favorite_activity_heating" | "nearby_activity_started" | "nearby_activity_heating" | "like_received" | "favorite_new_regular";

interface SendPushOptions {
  supabase: SupabaseClient; // Service Role client
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  placeId?: string; // Optional place context
}

/**
 * Core logic to send push notifications
 */
export async function sendPushNotification({ 
  supabase, 
  userId, 
  type, 
  title, 
  body, 
  data, 
  placeId 
}: SendPushOptions) {
  
  // 1. Check Notification Settings (User Preferences)
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Mapping logic: type -> setting column
  // Default to TRUE (allow) if no record found
  const isAllowed = (() => {
    if (!settings) return true; // Default allowed if no settings
    
    switch (type) {
      case "message_received":
        return settings.messages ?? true;
      case "match_created":
        return settings.matches ?? true;
      case "like_received":
        return settings.likes ?? true;
      // Activity / Places
      case "favorite_activity_started":
      case "favorite_activity_heating":
      case "favorite_new_regular":
        return settings.favorite_places ?? true;
      case "nearby_activity_started":
      case "nearby_activity_heating":
        return settings.nearby_activity ?? true;
      default:
        return true;
    }
  })();

  if (!isAllowed) {
    console.log(`[Push] Suppressed by user settings for ${userId} (type: ${type})`);
    return { skipped: true, reason: "user_settings" };
  }

  // Get real unread message count for badge (Apple/Google best practice for chat apps)
  // Badge should reflect actual unread count, not just "1"
  // Note: messages table has sender_id but not receiver_id - we count unread messages NOT sent by this user
  let unreadBadgeCount = 1; // Default fallback
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .neq("sender_id", userId)  // Messages not sent by this user = received messages
      .is("read_at", null);
    
    if (count !== null && count > 0) {
      unreadBadgeCount = count;
    }
  } catch (e) {
    console.warn("[Push] Failed to get unread count, using default badge", e);
  }

  // 2. Anti-Spam (TTL Check)
  // Only for activity types, messages/matches are immediate
  if (type.includes("activity")) {
    const ttlHours = type === "nearby_activity_heating" ? 12 : 6;
    const { data: recentLogs } = await supabase
      .from("notification_events")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("place_id", placeId) // Must match place if provided
      .gt("created_at", new Date(Date.now() - ttlHours * 3600 * 1000).toISOString())
      .limit(1);
 
    if (recentLogs && recentLogs.length > 0) {
      console.log(`[Push] Check skipped for ${userId} (TTL active for ${type})`);
      return { skipped: true, reason: "ttl" };
    }
  }

  // 2. Resolve Place Name (Contextual) if placeId is provided
  let placeName = "";
  if (placeId) {
    // Try to get place name
    const { data: place } = await supabase
      .from("places")
      .select("name")
      .eq("id", placeId)
      .single();
    
    if (place?.name) {
      placeName = place.name;
      // Inject place name into body placeholders if needed
      // But user passed finalized 'body', so we assume caller handled formatting or we append?
      // Requirement says: "Push SEMPRE deve ser contextual". verify logic.
      // If placeName exists, ensure it is in data payload.
      data.place_name = placeName;
    }
  }

  // 3. Fetch Active Devices
  const { data: devices, error: deviceError } = await supabase
    .from("user_devices")
    .select("id, fcm_token, platform")
    .eq("user_id", userId)
    .eq("active", true);

  if (deviceError || !devices || devices.length === 0) {
    console.log(`[Push] No active devices for ${userId}`);
    return { skipped: true, reason: "no_devices" };
  }

  // 4. Authenticate FCM
  const serviceAccountStr = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!serviceAccountStr) {
    console.error("[Push] Missing FCM_SERVICE_ACCOUNT secret");
    return { error: "missing_config" };
  }
  
  let accessToken: string;
  let projectId: string;
  
  try {
    const serviceAccount = JSON.parse(serviceAccountStr);
    projectId = serviceAccount.project_id;
    accessToken = await generateFCMToken(serviceAccount);
  } catch (e) {
    console.error("[Push] Failed to generate FCM token", e);
    return { error: "fcm_auth_failed" };
  }

  // 5. Send to all devices (Parallel)
  let sentCount = 0;
  
  const promises = devices.map(async (device) => {
    const payload: FCMPayload = {
      token: device.fcm_token,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        type,
        ...(placeId ? { place_id: placeId } : {}),
        click_action: "FLUTTER_NOTIFICATION_CLICK" // Standard for hybrid apps, adjust for Expo if needed
      },
      android: {
        priority: "high",
        notification: {
          sound: "default"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: unreadBadgeCount,
            contentAvailable: 1
          }
        }
      }
    };

    const result = await sendFCMMessage(projectId, accessToken, payload);

    if (!result.success) {
      console.error(`[Push] Failed to send to device ${device.id}: ${result.errorCode}`);
      
      // Handle Invalid Token
      if (result.errorCode === "UNREGISTERED" || result.errorCode === "INVALID_ARGUMENT") {
        await supabase
          .from("user_devices")
          .update({ active: false, last_active_at: new Date().toISOString() })
          .eq("id", device.id);
        console.log(`[Push] Deactivated invalid token for device ${device.id}`);
      }
    } else {
      sentCount++;
    }
  });

  await Promise.all(promises);

  // 6. Log Event
  if (sentCount > 0) {
    await supabase.from("notification_events").insert({
      user_id: userId,
      type,
      place_id: placeId || null,
    });
  }

  return { success: true, sent: sentCount };
}
