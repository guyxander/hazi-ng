import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";
import { sendPasswordRecovery, updateRecoveredPassword } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PasswordRecoveryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; email?: string; next?: string; reset?: string }>;
}) {
  const { error, message, email, next, reset } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const canResetPassword = reset === "1" && Boolean(userData.user);

  return (
    <main className="container grid min-h-[70vh] place-items-center py-12">
      <section className="w-full max-w-xl space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
            {message}
          </div>
        ) : null}

        {canResetPassword ? (
          <form action={updateRecoveredPassword} className="card space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
                <KeyRound size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--primary)]">Set new password</h1>
                <p className="text-sm text-[var(--muted)]">Choose a strong password for your Hazi.ng account.</p>
              </div>
            </div>

            <input
              className="input"
              name="password"
              type="password"
              minLength={8}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
              title="Password must be at least 8 characters and include uppercase, lowercase, number, and symbol."
              required
              placeholder="New password"
              autoComplete="new-password"
            />
            <p className="text-xs font-bold text-[var(--muted)]">
              Password must include uppercase, lowercase, number, symbol, and at least 8 characters.
            </p>
            <button className="button button-primary w-full" type="submit">Update password</button>
          </form>
        ) : (
        <form action={sendPasswordRecovery} className="card space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--primary)]">Recover password</h1>
              <p className="text-sm text-[var(--muted)]">Enter your email and Hazi.ng will send a reset link.</p>
            </div>
          </div>

          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <label className="grid gap-2 text-sm font-extrabold text-[var(--primary)]">
            Email address
            <input className="input" name="email" type="email" required defaultValue={email ?? ""} autoComplete="email" />
          </label>
          <button className="button button-primary w-full" type="submit">
            <MailCheck size={17} /> Send recovery link
          </button>
          <p className="text-center text-sm text-[var(--muted)]">
            Remembered it?{" "}
            <Link href={`/auth?next=${encodeURIComponent(next ?? "/dashboard")}`} className="font-extrabold text-[var(--primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
        )}
      </section>
    </main>
  );
}
