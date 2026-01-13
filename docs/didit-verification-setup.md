# Didit Identity Verification Setup

This document describes the complete implementation of identity verification using the Didit SDK.

## Overview

The verification flow integrates Didit's identity verification service with our app, using:
- **Backend**: Supabase Edge Functions for API integration and webhook handling
- **Database**: PostgreSQL column to track verification status
- **Frontend**: React Native with WebView integration and real-time updates
- **State Management**: Redux for global state
- **Real-time**: Supabase Realtime for instant status updates

## Architecture

```
User → Settings Screen → API Call → Didit Session → WebView
                                                       ↓
Webhook ← Didit Service ← User completes verification
   ↓
Update DB → Broadcast Realtime → Redux Update → UI Update
```

## Database Schema

### Migration: `20260115000000_add_verification_status.sql`

Adds `verification_status` column to `profiles` table:

```sql
ALTER TABLE profiles
ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified'
CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
```

**Status Values**:
- `unverified` (default): User hasn't started verification
- `pending`: Verification in progress or under review
- `verified`: Identity verified successfully
- `rejected`: Verification was declined

## Backend - Edge Functions

### 1. `didit-session` (Authenticated Endpoint)

**Purpose**: Create a Didit verification session

**Environment Variables**:
```bash
DIDIT_API_KEY=your_api_key
DIDIT_API_URL=https://verification.didit.me (default)
DIDIT_WORKFLOW_ID=your_workflow_id
DIDIT_WEBHOOK_URL=your_webhook_url (optional)
```

**Flow**:
1. Authenticate user
2. Check if already verified (returns error if true)
3. Allow retry if status is `pending` (creates new session)
4. Call Didit API: `POST /v2/session/`
5. Update profile status to `pending`
6. Return verification URL to client

**API Call to Didit**:
```typescript
POST https://verification.didit.me/v2/session/
Headers:
  x-api-key: YOUR_API_KEY
  accept: application/json
  content-type: application/json
Body:
  {
    "workflow_id": "your_workflow_id",
    "vendor_data": "user_id",  // Our user ID for webhook
    "callback": "webhook_url"   // Optional webhook URL
  }
```

**Reference**: https://docs.didit.me/reference/quick-start

### 2. `didit-webhook` (Public Endpoint)

**Purpose**: Receive verification results from Didit

**Environment Variables**:
```bash
DIDIT_WEBHOOK_SECRET=your_webhook_secret
```

**Security**:
- Validates `X-Signature` header (HMAC-SHA256 of raw body)
- Validates `X-Timestamp` header (must be within 5 minutes)
- Uses timing-safe comparison to prevent timing attacks

**Flow**:
1. Validate webhook signature and timestamp
2. Parse payload (only process `status.updated` type)
3. Extract `user_id` from `vendor_data`
4. Map Didit status to our status:
   - `"Approved"` → `verified`
   - `"Declined"` → `rejected`
   - `"In Progress"` | `"In Review"` → `pending`
5. Update database
6. Broadcast update via Realtime to channel `user:${userId}`

**Webhook Headers**:
```
X-Signature: HMAC-SHA256 hex signature
X-Timestamp: Unix timestamp
```

**Webhook Payload**:
```typescript
{
  session_id: string;
  status: "Approved" | "Declined" | "In Progress" | "In Review";
  webhook_type: "status.updated";
  vendor_data: string;  // Our user_id
  workflow_id: string;
  timestamp: number;
  created_at: number;
}
```

**Reference**: https://docs.didit.me/reference/webhooks

## Frontend Implementation

### Redux State (`profileSlice.ts`)

Added fields:
```typescript
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type ProfileData = {
  // ... existing fields
  verification_status?: VerificationStatus | null;
};

// Actions
setVerificationStatus(state, action: PayloadAction<VerificationStatus>)
```

### Realtime Listener (`use-verification-status-listener.ts`)

**Hook**: `useVerificationStatusListener()`

- Subscribes to Realtime channel `user:${userId}`
- Listens for `verification_status_updated` event
- Updates Redux immediately
- Refetches full profile for consistency
- Must be called inside `ReduxProvider`

**Integration**: Wrapped in `<VerificationListener />` component placed inside `<ReduxProvider>` in `app/_layout.tsx`

### API Module (`modules/profile/api.ts`)

**Method**: `createVerificationSession()`

Encapsulates the call to `didit-session` Edge Function:

```typescript
const { data } = await supabase.functions.invoke("didit-session", {
  method: "POST",
});

return {
  verification_url: data.verification_url,
  session_id: data.session_id,
  status: data.status,
};
```

### Helper (`modules/profile/helpers.ts`)

**Function**: `getUserId()`

Gets current user ID directly from Redux store without needing `useAppSelector` hook:

```typescript
export function getUserId(): string | undefined {
  const state = store.getState();
  return state.profile.data?.id;
}
```

### UI Components

#### 1. Profile Screen (`app/(tabs)/(profile)/index.tsx`)

**Verification Badge**:
- Shows `CircleCheckDashedIcon` next to user name
- Color changes based on status:
  - `verified` → `colors.accent` (blue)
  - Other → `colors.textSecondary` (gray)

```tsx
const isVerified = profile?.verification_status === "verified";
const verificationBadgeColor = isVerified ? colors.accent : colors.textSecondary;

<CircleCheckDashedIcon color={verificationBadgeColor} />
```

#### 2. Settings Screen (`app/main/settings.tsx`)

**Verification Button**:
- Hidden if status is `verified`
- Shows "Verificação em análise" description if status is `pending`
- Allows retry even when `pending` (creates new session)
- Shows loading indicator during session creation
- Opens WebView modal with verification URL

```tsx
{profile?.verification_status !== "verified" && (
  <SettingItem
    title={t("screens.profile.settingsPage.account.verifyProfile")}
    description={
      profile?.verification_status === "pending"
        ? t("screens.profile.settingsPage.account.verification.retryDescription")
        : undefined
    }
    onClick={handleVerifyProfile}
    disabled={isVerifying}
    rightContent={
      isVerifying ? <ActivityIndicator size="small" color={colors.accent} /> : undefined
    }
  />
)}
```

#### 3. WebView Modal (`app/(modals)/verification-webview.tsx`)

**Integration**: Follows official Didit mobile recommendations

**Features**:
- Uses `BaseTemplateScreen` with `isModal` prop
- Uses `XIcon` for close button
- Embeds verification flow in `WebView`
- Android back button navigates WebView history before closing modal
- Configured with Didit-recommended properties

**WebView Configuration**:
```tsx
<WebView
  ref={webViewRef}
  source={{ uri: verificationUrl }}
  userAgent="Mozilla/5.0 (Linux; Android 10; Mobile)..."
  mediaPlaybackRequiresUserAction={false}
  allowsInlineMediaPlayback={true}
  domStorageEnabled={true}
  androidHardwareAccelerationDisabled={false}
  androidLayerType="hardware"
  onNavigationStateChange={(navState) => {
    setCanGoBack(navState.canGoBack);
  }}
/>
```

**Android Back Button Handling**:
```tsx
useEffect(() => {
  const backHandler = BackHandler.addEventListener(
    "hardwareBackPress",
    () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent default (closes modal)
      }
      return false; // Allow default (closes modal)
    }
  );
  return () => backHandler.remove();
}, [canGoBack]);
```

**Reference**: https://docs.didit.me/reference/ios-android

#### 4. Setting Item Component (`components/setting-item.tsx`)

Added `disabled` prop:
```tsx
export interface SettingItemProps {
  // ... existing props
  disabled?: boolean;
}

// Styling
opacity: disabled ? 0.5 : onClick && pressed ? 0.9 : 1
```

### Translations

Added to `pt.json`, `en.json`, `es.json`:

```json
{
  "screens": {
    "profile": {
      "settingsPage": {
        "account": {
          "verifyProfile": "Verificar perfil",
          "verification": {
            "pending": "Verificação em análise",
            "pendingDescription": "Sua verificação está sendo analisada.",
            "retryDescription": "Toque para continuar ou iniciar nova verificação.",
            "pendingTitle": "Verificação em análise",
            "pendingMessage": "Sua verificação já está em andamento. Por favor, aguarde.",
            "alreadyVerified": "Seu perfil já está verificado!"
          }
        }
      }
    }
  }
}
```

## Installation

### Dependencies

Install `react-native-webview`:

```bash
yarn add react-native-webview
npx pod-install  # For iOS
```

### Database Migration

Run the migration:

```bash
supabase db push
```

### Edge Functions Deployment

Deploy both functions:

```bash
supabase login
supabase functions deploy didit-session
supabase functions deploy didit-webhook
```

### Environment Variables

Set in Supabase Dashboard → Project Settings → Edge Functions:

```bash
DIDIT_API_KEY=your_api_key
DIDIT_WORKFLOW_ID=your_workflow_id
DIDIT_WEBHOOK_URL=https://your-project.supabase.co/functions/v1/didit-webhook
DIDIT_WEBHOOK_SECRET=your_webhook_secret
```

Get these values from your Didit dashboard.

## Testing Flow

1. **Start Verification**:
   - Go to Settings
   - Tap "Verificar perfil"
   - Profile status changes to `pending`

2. **Complete Verification**:
   - WebView opens with Didit verification flow
   - User completes identity verification
   - User can close modal when done

3. **Webhook Processing**:
   - Didit sends webhook to `didit-webhook` endpoint
   - Webhook validates signature
   - Database updated with final status (`verified` or `rejected`)
   - Realtime broadcast sent

4. **UI Update**:
   - App receives Realtime event
   - Redux updates automatically
   - Profile badge turns blue (if verified)
   - Verification button disappears (if verified)

## Troubleshooting

### Webhook Not Receiving Events

1. Check Didit webhook configuration:
   - URL: `https://your-project.supabase.co/functions/v1/didit-webhook`
   - Events: Enable "status.updated"

2. Check Edge Function logs:
   ```bash
   supabase functions logs didit-webhook
   ```

3. Verify `DIDIT_WEBHOOK_SECRET` matches Didit dashboard

### Signature Validation Failing

- Ensure `DIDIT_WEBHOOK_SECRET` is correct
- Check webhook logs for timestamp issues (must be within 5 minutes)
- Verify raw body is used for signature (not parsed JSON)

### Session Creation Failing

1. Check `didit-session` logs:
   ```bash
   supabase functions logs didit-session
   ```

2. Verify environment variables:
   - `DIDIT_API_KEY`
   - `DIDIT_WORKFLOW_ID`

3. Check Didit API status and quotas

### Redux Context Error

- Ensure `<VerificationListener />` is inside `<ReduxProvider>`
- Check that `useVerificationStatusListener` is not called outside Redux context

### WebView Not Loading

- Check network connection
- Verify verification URL is valid
- Check WebView error logs in console
- Ensure `react-native-webview` is properly installed

## Security Considerations

1. **Webhook Signature**: Always validate `X-Signature` and `X-Timestamp`
2. **HTTPS Only**: Never expose webhook URL over HTTP
3. **Timing Attacks**: Use `timingSafeEqual` for signature comparison
4. **Replay Attacks**: Validate timestamp (5-minute window)
5. **User ID**: Always use authenticated user ID, never trust client input

## References

- [Didit Quick Start](https://docs.didit.me/reference/quick-start)
- [Didit Webhooks](https://docs.didit.me/reference/webhooks)
- [Didit iOS/Android Integration](https://docs.didit.me/reference/ios-android)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
