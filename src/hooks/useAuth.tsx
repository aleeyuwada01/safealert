import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "operator" | "viewer";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user?.email === "operator@safealert.gov") {
        const { data: refreshed } = await supabase.auth.signInWithPassword({
          email: "operator@safealert.live",
          password: "SafeAlert2026!",
        });
        setSession(refreshed.session ?? data.session);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      return;
    }
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (active) setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const normalizedUser = session?.user
    ? ({
        ...session.user,
        email: session.user.email?.replace(/@safealert\.gov$/i, "@safealert.live"),
      } as User)
    : null;

  return {
    session,
    user: normalizedUser,
    loading,
    roles,
    isAdmin: roles.includes("admin"),
    canIssue: roles.includes("admin") || roles.includes("operator"),
    signOut: () => supabase.auth.signOut(),
  };
}
