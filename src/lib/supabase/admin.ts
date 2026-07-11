import { redirect } from "next/navigation";
import { getSafeUser } from "./auth";
import { createSupabaseServerClient } from "./server";
import { isAdminRole } from "@/lib/roles";

export async function requireAdmin(next = "/admin") {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const user = await getSafeUser(supabase);

  if (!user) {
    redirect(`/auth?next=${next}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  return supabase;
}
