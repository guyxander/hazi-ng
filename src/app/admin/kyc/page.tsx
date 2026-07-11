import Link from "next/link";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { reviewVerification } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function KycAdminPage() {
  const supabase = await requireAdmin("/admin/kyc");

  const { data: records } = supabase
    ? await supabase
        .from("verification_records")
        .select("id,user_id,document_type,status,provider,provider_reference,metadata,notes,document_url,document_name,liveness_url,liveness_name,liveness_status,face_match_status,rejection_reason,created_at,profiles(id,full_name,verification_status)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
    : { data: [] };

  const recordsWithUrls = supabase
    ? await Promise.all((records ?? []).map(async (record) => {
      const [{ data: documentUrl }, { data: livenessUrl }] = await Promise.all([
        record.document_url
          ? supabase.storage.from("verification-documents").createSignedUrl(record.document_url, 60 * 10)
          : Promise.resolve({ data: null }),
        record.liveness_url
          ? supabase.storage.from("verification-documents").createSignedUrl(record.liveness_url, 60 * 10)
          : Promise.resolve({ data: null })
      ]);

      return { ...record, signedUrl: documentUrl?.signedUrl ?? null, livenessSignedUrl: livenessUrl?.signedUrl ?? null };
    }))
    : [];

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><ShieldCheck size={14} /> Admin verification</span>
          <h1 className="section-title mt-4">KYC approval queue</h1>
          <p className="mt-2 text-[var(--muted)]">Review identity verification submissions and update the user trust badge.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {recordsWithUrls.length ? recordsWithUrls.map((record) => {
            const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;

            return (
              <div key={record.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_260px]">
                <div>
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><FileCheck2 size={17} /> {profile?.full_name ?? "Hazi user"}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{record.document_type}</p>
                  {record.signedUrl ? (
                    <a href={record.signedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                      Open document
                    </a>
                  ) : null}
                  {record.livenessSignedUrl ? (
                    <a href={record.livenessSignedUrl} target="_blank" rel="noreferrer" className="mt-2 ml-3 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">
                      Open live selfie
                    </a>
                  ) : null}
                  {record.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{record.notes}</p> : null}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Current status</p>
                  <p className="font-extrabold text-[var(--primary)]">{profile?.verification_status ?? record.status}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Liveness: {record.liveness_status}</p>
                  <p className="text-sm text-[var(--muted)]">Face match: {record.face_match_status}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Provider: {record.provider ?? "admin_review"}</p>
                  <p className="text-sm text-[var(--muted)]">Reference: {record.provider_reference ?? "Pending"}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <form action={reviewVerification} className="grid gap-2">
                    <input type="hidden" name="record_id" value={record.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <input type="hidden" name="liveness_status" value="passed" />
                    <input type="hidden" name="face_match_status" value="matched" />
                    <input className="input" name="provider" defaultValue={record.provider ?? "admin_review"} placeholder="Provider" />
                    <input className="input" name="provider_reference" defaultValue={record.provider_reference ?? ""} placeholder="Provider reference" />
                    <input className="input" name="provider_score" type="number" min="0" max="100" step="0.01" placeholder="Score, optional" />
                    <input type="hidden" name="notes" value="Approved by admin/provider review." />
                    <button className="button button-primary" type="submit">Approve</button>
                  </form>
                  <form action={reviewVerification} className="grid gap-2">
                    <input type="hidden" name="record_id" value={record.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input type="hidden" name="liveness_status" value="failed" />
                    <input type="hidden" name="face_match_status" value="failed" />
                    <input type="hidden" name="provider" value={record.provider ?? "admin_review"} />
                    <input type="hidden" name="provider_reference" value={record.provider_reference ?? ""} />
                    <input className="input" name="notes" defaultValue="Rejected by admin review. Please resubmit clearer documents." />
                    <button className="button button-outline" type="submit">Reject</button>
                  </form>
                </div>
              </div>
            );
          }) : <p className="p-5 text-[var(--muted)]">No pending verification requests.</p>}
        </div>
      </section>
    </main>
  );
}
