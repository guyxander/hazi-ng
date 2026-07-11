import Link from "next/link";
import { Globe2, LockKeyhole, ShieldCheck, UserPlus, X } from "lucide-react";
import { resendSignupConfirmation, signIn, signUp } from "@/app/actions";

function authModeHref(mode: "signin" | "signup", next?: string, ref?: string) {
  const params = new URLSearchParams();

  if (mode === "signup") {
    params.set("mode", "signup");
  }

  if (next) {
    params.set("next", next);
  }

  if (ref) {
    params.set("ref", ref);
  }

  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

export default async function AuthPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string; confirm_email?: string; mode?: string; ref?: string; recover?: string; email?: string }>;
}) {
  const { error, message, next, confirm_email: confirmEmail, mode, ref, recover, email } = await searchParams;
  const isSignUp = mode === "signup";
  const recoveryEmail = email ?? confirmEmail ?? "";
  const recoveryHref = `/auth/recover?${new URLSearchParams({
    next: next ?? "/dashboard",
    ...(recoveryEmail ? { email: recoveryEmail } : {})
  }).toString()}`;

  return (
    <>
      <main className="container grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="auth-trust-panel flex min-h-[560px] flex-col justify-between overflow-hidden p-8 text-white">
          <div>
            <span className="badge bg-white/15 text-white"><ShieldCheck size={14} /> Hazi trust account</span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-5xl">Sign in to bid, sell, verify, and manage auctions.</h1>
            <p className="mt-5 max-w-lg text-white/80">Supabase Auth powers buyer and seller identity. Profile records are protected by row-level security.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {["Visible bids", "KYC-ready", "Escrow chat"].map((item) => (
              <div key={item} className="rounded-xl bg-white/10 p-4 text-sm font-bold">{item}</div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          {error && !confirmEmail ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
              {message}
            </div>
          ) : null}

          <form action="/auth/google" method="get" className="card space-y-4 p-6">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <button className="button button-outline w-full bg-white" type="submit">
              <Globe2 size={18} />
              Continue with Google
            </button>
          </form>

          {isSignUp ? (
            <form key="signup-form" action={signUp} className="card space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><UserPlus size={20} /></div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[var(--primary)]">Create account</h2>
                  <p className="text-sm text-[var(--muted)]">Start buying, selling, and managing items on Hazi.</p>
                </div>
              </div>
              <input className="input" name="full_name" required placeholder="Full name" autoComplete="name" />
              {ref ? <input type="hidden" name="referral_id" value={ref} /> : null}
              <input className="input" name="email" type="email" required placeholder="Email address" autoComplete="email" />
              <input
                className="input"
                name="password"
                type="password"
                minLength={8}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                title="Password must be at least 8 characters and include uppercase, lowercase, number, and symbol."
                required
                placeholder="Password"
                autoComplete="new-password"
              />
              <p className="text-xs font-bold text-[var(--muted)]">
                Password must include uppercase, lowercase, number, symbol, and at least 8 characters.
              </p>
              <button className="button button-accent w-full" type="submit">Create Hazi account</button>
              <p className="text-center text-sm text-[var(--muted)]">
                Already have an account?{" "}
                <Link className="font-extrabold text-[var(--primary)]" href={authModeHref("signin", next, ref)}>
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form key="signin-form" action={signIn} className="card space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><LockKeyhole size={20} /></div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[var(--primary)]">Sign in</h2>
                  <p className="text-sm text-[var(--muted)]">Continue to your Hazi workspace.</p>
                </div>
              </div>
              <input type="hidden" name="next" value={next ?? "/dashboard"} />
              <input className="input" name="email" type="email" required placeholder="Email address" defaultValue={recoveryEmail} autoComplete="email" />
              <input className="input" name="password" type="password" required placeholder="Password" autoComplete="current-password" />
              <div className="flex justify-end">
                <Link href={recoveryHref} className="text-sm font-extrabold text-[var(--primary)] hover:underline">
                  Forgot your password?
                </Link>
              </div>
              <button className="button button-primary w-full" type="submit">Sign in</button>
              {recover === "1" ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm font-bold text-[var(--primary)]">
                  Forgot your password?{" "}
                  <Link href={recoveryHref} className="text-[var(--accent)] hover:underline">
                    Recover it here
                  </Link>
                  .
                </div>
              ) : null}
              <p className="text-center text-sm text-[var(--muted)]">
                New to Hazi.ng?{" "}
                <Link className="font-extrabold text-[var(--primary)]" href={authModeHref("signup", next, ref)}>
                  Create account
                </Link>
              </p>
            </form>
          )}
        </section>
      </main>

      {confirmEmail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#001f1a]/55 px-4 py-8 backdrop-blur-sm">
          <form
            action={resendSignupConfirmation}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-email-title"
            className="card w-full max-w-md space-y-5 border-2 border-[var(--accent)] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="confirm-email-title" className="text-2xl font-extrabold text-[var(--primary)]">Confirm your email</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  We found your account, but your email needs confirmation before you can sign in.
                </p>
              </div>
              <Link
                href={`/auth?next=${encodeURIComponent(next ?? "/dashboard")}`}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--primary)]"
                aria-label="Close confirmation dialog"
              >
                <X size={18} />
              </Link>
            </div>
            <input className="input" name="email" type="email" required defaultValue={confirmEmail} />
            <button className="button button-accent w-full" type="submit">Resend confirmation email</button>
          </form>
        </div>
        ) : null}
    </>
  );
}
