"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { createAuction } from "@/app/actions";
import { GeolocationFields } from "@/components/geolocation-fields";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

const AUCTION_IMAGE_BUCKET = "auction-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_COUNT = 6;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type SellPublishFormProps = {
  categories: Category[];
  agentJobs?: Array<{
    id: string;
    label: string;
    status: string | null;
    location: string | null;
  }>;
  agentModeRequired?: boolean;
  returnTo?: string;
};

function slugFileName(name: string) {
  const parts = name.split(".");
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : "jpg";
  const base = parts
    .join(".")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return `${base || "auction-image"}.${extension || "jpg"}`;
}

export function SellPublishForm({ categories, agentJobs = [], agentModeRequired = false, returnTo = "/sell" }: SellPublishFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priceSuggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPriceSuggestionKeyRef = useRef("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<string | null>(null);
  const [priceSuggestionError, setPriceSuggestionError] = useState<string | null>(null);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isSubmitting = Boolean(uploadProgress) || isPending;

  useEffect(() => {
    return () => {
      if (priceSuggestionTimerRef.current) {
        clearTimeout(priceSuggestionTimerRef.current);
      }
    };
  }, []);

  async function suggestPrice() {
    const form = formRef.current;

    if (!form || isSuggestingPrice) {
      return;
    }

    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category_id") ?? "").trim();
    const condition = String(formData.get("condition") ?? "").trim();

    if (title.length < 3) {
      setPriceSuggestion(null);
      setPriceSuggestionError(null);
      return;
    }

    const suggestionKey = JSON.stringify({ title, description, category, condition });
    if (lastPriceSuggestionKeyRef.current === suggestionKey) {
      return;
    }

    lastPriceSuggestionKeyRef.current = suggestionKey;
    setIsSuggestingPrice(true);
    setPriceSuggestion(null);
    setPriceSuggestionError(null);

    try {
      const response = await fetch("/api/price-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Price suggestion failed.");
      }

      const recommended = payload.recommendedPrice ? Number(payload.recommendedPrice).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }) : "Not enough market data yet";
      setPriceSuggestion(`Recommended price: ${recommended}`);
    } catch (error) {
      setPriceSuggestionError(error instanceof Error ? error.message : "Could not suggest a price yet.");
    } finally {
      setIsSuggestingPrice(false);
    }
  }

  function schedulePriceSuggestion() {
    if (priceSuggestionTimerRef.current) {
      clearTimeout(priceSuggestionTimerRef.current);
    }

    priceSuggestionTimerRef.current = setTimeout(() => {
      void suggestPrice();
    }, 900);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const fileInput = fileInputRef.current;
    const files = Array.from(fileInput?.files ?? []).slice(0, MAX_IMAGE_COUNT);
    const formData = new FormData(form);
    formData.delete("photos");
    formData.delete("uploaded_image_url");
    setUploadError(null);

    const invalidFile = files.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
    if (invalidFile) {
      setUploadError("Upload JPEG, PNG, WebP, or GIF images only.");
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversizedFile) {
      setUploadError("Each auction photo must be 5MB or smaller.");
      return;
    }

    try {
      if (files.length) {
        const supabase = createSupabaseBrowserClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
          window.location.href = "/auth?next=/sell";
          return;
        }

        for (const [index, file] of files.entries()) {
          setUploadProgress(`Uploading photo ${index + 1} of ${files.length}...`);
          const filePath = `${userData.user.id}/pending/${crypto.randomUUID()}-${slugFileName(file.name)}`;
          const { error: uploadError } = await supabase.storage
            .from(AUCTION_IMAGE_BUCKET)
            .upload(filePath, file, {
              cacheControl: "3600",
              contentType: file.type,
              upsert: false
            });

          if (uploadError) {
            throw uploadError;
          }

          const { data: publicUrl } = supabase.storage
            .from(AUCTION_IMAGE_BUCKET)
            .getPublicUrl(filePath);

          formData.append("uploaded_image_url", publicUrl.publicUrl);
        }
      }

      setUploadProgress("Publishing auction...");
      startTransition(async () => {
        await createAuction(formData);
      });
    } catch {
      setUploadProgress(null);
      setUploadError("We could not upload the photos. Try smaller images or a stronger connection.");
    }
  }

  return (
    <form ref={formRef} onChange={schedulePriceSuggestion} onSubmit={handleSubmit} encType="multipart/form-data" className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="card space-y-5 p-6">
        <div>
          <label className="text-sm font-extrabold text-[var(--primary)]">Title</label>
          <input className="input mt-2" name="title" required placeholder="e.g. Matte Black Audiophile Headphones" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Category</label>
            <select className="select mt-2" name="category_id" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Condition</label>
            <select className="select mt-2" name="condition" defaultValue="good">
              <option value="like_new">Like new</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="needs_repair">Needs repair</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-extrabold text-[var(--primary)]">Description</label>
          <textarea className="textarea mt-2" name="description" required placeholder="Describe condition, accessories, pickup notes, and anything buyers should know." />
        </div>
        <div>
          <label className="text-sm font-extrabold text-[var(--primary)]">Seller price</label>
          <input className="input mt-2" name="seller_price" required type="number" min="1" placeholder="185000" />
        </div>
        <input type="hidden" name="return_to" value={returnTo} />
        {agentModeRequired ? <input type="hidden" name="agent_listing_mode" value="1" /> : null}
        {agentModeRequired || agentJobs.length ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
            <label className="text-sm font-extrabold text-[var(--primary)]">Client for this agent listing</label>
            <select className="select mt-2" name="agent_job_id" defaultValue="" required={agentModeRequired}>
              <option value="" disabled={agentModeRequired}>{agentModeRequired ? "Choose assigned client" : "This is my own listing"}</option>
              {agentJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.label}{job.location ? ` - ${job.location}` : ""} ({job.status ?? "assigned"})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs font-bold text-[var(--muted)]">
              Agent listings must be tied to a client. Sale release splits 70% to the client, 21% to you, and 9% to Hazi.ng.
            </p>
            {agentModeRequired && !agentJobs.length ? (
              <p className="mt-2 text-xs font-extrabold text-red-700">You need an assigned client request before posting an agent auction.</p>
            ) : null}
          </div>
        ) : null}
        {priceSuggestion ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm font-bold text-[var(--primary)]">
            {priceSuggestion}
          </div>
        ) : null}
        {isSuggestingPrice ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm font-bold text-[var(--primary)]">
            Finding a fair market price...
          </div>
        ) : null}
        {priceSuggestionError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {priceSuggestionError}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Auction duration</label>
            <select className="select mt-2" name="duration_hours" defaultValue="72">
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-5">
          <label className="text-sm font-extrabold text-[var(--primary)]">Upload photos</label>
          <input
            ref={fileInputRef}
            className="mt-3 block w-full rounded-xl bg-white p-3 text-sm font-bold text-[var(--muted)]"
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
          />
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Upload up to 6 images. JPEG, PNG, WebP, or GIF. Max 5MB each.</p>
          {uploadProgress ? <p className="mt-3 text-sm font-extrabold text-[var(--primary)]">{uploadProgress}</p> : null}
          {uploadError ? <p className="mt-3 text-sm font-extrabold text-red-700">{uploadError}</p> : null}
        </div>
        <GeolocationFields required addressName="location" />
      </section>

      <aside className="card h-fit space-y-5 p-6">
        <h2 className="text-2xl font-extrabold text-[var(--primary)]">Listing rules</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Buyers can bid from 50% of your seller price. Public bid history stays visible, and buyer identity is revealed after you accept a bid.</p>
        <label className="flex items-center gap-3 text-sm font-bold text-[var(--muted)]">
          <input type="checkbox" name="pickup_available" defaultChecked />
          Pickup available
        </label>
        <label className="flex items-center gap-3 text-sm font-bold text-[var(--muted)]">
          <input type="checkbox" name="delivery_available" defaultChecked />
          Delivery available
        </label>
        <button className="button button-primary w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Publishing..." : "Publish Auction"}
        </button>
      </aside>
    </form>
  );
}
