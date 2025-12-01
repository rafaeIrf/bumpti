import { useEffect, useState } from "react";
import { supabase } from "@/modules/supabase/client";

export function useCurrentUser() {
  const [user, setUser] = useState<Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    };

    loadUser();

    const { data: authSub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      authSub?.subscription.unsubscribe();
    };
  }, []);

  return { user, userId: user?.id ?? null, loading };
}
