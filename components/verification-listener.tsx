import { useVerificationStatusListener } from "@/hooks/use-verification-status-listener";

/**
 * Wrapper component to ensure useVerificationStatusListener is called
 * inside the Redux context.
 * 
 * This component doesn't render anything - it just sets up the listener.
 */
export function VerificationListener() {
  useVerificationStatusListener();
  return null;
}
