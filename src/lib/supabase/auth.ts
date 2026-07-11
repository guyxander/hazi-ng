import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getSafeUser(supabase: SupabaseClient | null): Promise<User | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user;
  } catch {
    return null;
  }
}
