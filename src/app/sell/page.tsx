import { SellPublishForm } from "@/components/sell-publish-form";
import { redirect } from "next/navigation";
import { isAgentRole } from "@/lib/roles";
import { getCategories } from "@/lib/supabase/queries";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SellPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const categories = await getCategories();
  const supabase = await createSupabaseServerClient();
  const user = await getSafeUser(supabase);
  const { data: profile } = user && supabase
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (isAgentRole(profile?.role)) {
    redirect("/sell/agent");
  }
  const errorMessages: Record<string, string> = {
    "pickup-location": "Choose a suggested pickup address or use your current location before publishing the auction.",
    "missing-fields": "Complete the title, description, and seller price before publishing the auction.",
    "image-type": "Upload JPEG, PNG, WebP, or GIF images only.",
    "image-size": "Each auction photo must be 5MB or smaller.",
    "image-upload": "We could not upload the photos. Try smaller images or a stronger connection.",
    "image-save": "Your auction was created, but the photos could not be attached. Please try again.",
    "publish-failed": "We could not publish the auction yet. Please try again.",
    "agent-job": "Choose a valid assigned agent job before publishing an agent-assisted listing."
  };
  const errorMessage = params?.error ? errorMessages[params.error] : null;

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium">Seller workflow</span>
        <h1 className="section-title mt-4">Post an item for auction</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Create a Hazi listing with seller price, minimum-bid logic, pickup, delivery, and verification-ready metadata.</p>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <SellPublishForm categories={categories} />
    </main>
  );
}
