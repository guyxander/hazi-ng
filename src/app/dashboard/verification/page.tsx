import { redirect } from "next/navigation";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { submitVerification } from "@/app/actions";
import { SuccessAnimation } from "@/components/success-animation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function VerificationPage({
  searchParams
}: {
  searchParams?: Promise<{ submitted?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingSupabase />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/verification");
  }

  const [{ data: profile }, { data: records }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,verification_status").eq("id", user.id).single(),
    supabase
      .from("verification_records")
      .select("id,document_type,status,notes,document_url,document_name,created_at,reviewed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const recordsWithUrls = await Promise.all((records ?? []).map(async (record) => {
    if (!record.document_url) {
      return { ...record, signedUrl: null };
    }

    const { data } = await supabase.storage
      .from("verification-documents")
      .createSignedUrl(record.document_url, 60 * 10);

    return { ...record, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-trust"><ShieldCheck size={14} /> Identity verification</span>
        <h1 className="section-title mt-4">Verify your Hazi.ng account</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Upload an ID document and a live selfie for liveness/face match review. Files are stored privately and shared through short-lived signed links.</p>
      </div>

      {params?.submitted === "1" ? (
        <div className="mb-6">
          <SuccessAnimation title="Verification submitted" message="Your ID document and liveness selfie have been sent for admin review." />
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form action={submitVerification} encType="multipart/form-data" className="card space-y-5 p-6">
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Full name</label>
            <input className="input mt-2" name="full_name" required defaultValue={profile?.full_name ?? user.email?.split("@")[0] ?? ""} />
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Document type</label>
            <select className="select mt-2" name="document_type" defaultValue="government_id">
              <option value="government_id">Government ID</option>
              <option value="nin">NIN slip</option>
              <option value="drivers_license">Driver&apos;s license</option>
              <option value="passport">Passport</option>
              <option value="business_registration">Business registration</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Document file</label>
            <input className="input mt-2" name="document_file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
            <p className="mt-2 text-xs font-bold text-[var(--muted)]">JPEG, PNG, WebP, or PDF. Maximum 10MB.</p>
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Live selfie</label>
            <input className="input mt-2" name="liveness_file" type="file" required accept="image/jpeg,image/png,image/webp" />
            <p className="mt-2 text-xs font-bold text-[var(--muted)]">Take a clear current selfie. Admin must pass liveness and face match before approval.</p>
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Notes</label>
            <textarea className="textarea mt-2" name="notes" placeholder="Add any details that help support verify your identity." />
          </div>
          <button className="button button-primary w-full" type="submit">Submit verification</button>
        </form>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Current status</h2>
            <div className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-bold text-[var(--muted)]">Profile verification</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">{profile?.verification_status ?? "unverified"}</p>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Requests</h2>
            <div className="mt-4 space-y-3">
              {recordsWithUrls.length ? recordsWithUrls.map((record) => (
                <div key={record.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><FileCheck2 size={16} /> {record.document_type}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{record.status}</p>
                  {record.signedUrl ? (
                    <a href={record.signedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                      View uploaded document
                    </a>
                  ) : null}
                  {record.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{record.notes}</p> : null}
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No verification requests yet.</p>}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function MissingSupabase() {
  return (
    <main className="container py-10">
      <div className="card p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase env is missing</h1>
      </div>
    </main>
  );
}
