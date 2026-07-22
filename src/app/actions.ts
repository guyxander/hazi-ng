"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createFlutterwaveTransfer, initializeFlutterwavePayment, isFlutterwaveConfigured } from "@/lib/flutterwave";
import { getAiDeliveryEstimate } from "@/lib/ai-delivery-estimate";
import { getDeliveryEstimate, hasCoordinates, isWithinNigeria } from "@/lib/delivery-estimate";
import { sendExternalNotification } from "@/lib/notifications";
import { getCanonicalProductionOrigin } from "@/lib/site-url";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ASSIGNABLE_PROFILE_ROLES, canUseAgentDashboard, isAdminRole, isSuperAdminRole, SELF_SELECTABLE_PROFILE_ROLES } from "@/lib/roles";

const AUCTION_IMAGE_BUCKET = "auction-images";
const VERIFICATION_DOCUMENT_BUCKET = "verification-documents";
const PAYMENT_PROOF_BUCKET = "payment-proofs";
const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence";
const MAX_AUCTION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VERIFICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_DISPUTE_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUCTION_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const ALLOWED_VERIFICATION_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
const ALLOWED_PAYMENT_PROOF_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
const ALLOWED_DISPUTE_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
const PREMIUM_PLANS = {
  premium_seller: {
    label: "Premium Seller",
    amount: 5000
  },
  premium_agent: {
    label: "Premium Agent",
    amount: 10000
  },
  premium_business: {
    label: "Premium Business",
    amount: 15000
  }
} as const;
const LISTING_BOOST_PLANS = new Set(["listing_boost_7d", "listing_boost_14d", "listing_boost_30d"]);
const PREMIUM_BOOST_LIMITS: Record<string, number | null> = {
  premium_seller: 5,
  premium_agent: 30,
  premium_business: null
};

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isStrongPassword(password: string) {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getOptionalCoordinate(formData: FormData, name: string) {
  const value = getString(formData, name);

  if (!value) {
    return null;
  }

  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
}

function getOptionalNigeriaCoordinates(formData: FormData) {
  const latitude = getOptionalCoordinate(formData, "latitude");
  const longitude = getOptionalCoordinate(formData, "longitude");

  if (latitude === null || longitude === null) {
    return {
      latitude: null,
      longitude: null
    };
  }

  if (!isWithinNigeria(latitude, longitude)) {
    return {
      latitude: null,
      longitude: null
    };
  }

  return {
    latitude,
    longitude
  };
}

function authRedirectParams(message: string) {
  return encodeURIComponent(message);
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

async function getAppOrigin() {
  if (process.env.NODE_ENV === "production") {
    return getCanonicalProductionOrigin();
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "127.0.0.1:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

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

function isUsableImageFile(value: FormDataEntryValue): value is File {
  return value instanceof File && value.size > 0;
}

function isUsableFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

async function assertActiveAccount(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status,suspension_reason")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.account_status === "suspended") {
    throw new Error(profile.suspension_reason || "This account is suspended. Contact Hazi.ng support.");
  }
}

async function requireAdminAction(next = "/admin/health") {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=${next}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  return { supabase, user, profile };
}

async function requireAgentDashboardAction(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  message: string
) {
  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const [{ data: profile }, { data: activePremium }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("premium_subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .is("auction_id", null)
      .eq("plan", "premium_agent")
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle()
  ]);

  if (!canUseAgentDashboard(profile?.role, activePremium?.plan)) {
    throw new Error(message);
  }
}

async function upsertProfilePreservingAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  values: Record<string, string | number | null>
) {
  if (!supabase) {
    return;
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const nextValues: Record<string, string | number | null> = { id: userId, ...values };

  if (["admin", "superadmin", "agent"].includes(existingProfile?.role ?? "")) {
    delete nextValues.role;
  }

  await supabase.from("profiles").upsert(nextValues);
}

async function recordAuditLog(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  }
) {
  if (!supabase) {
    return;
  }

  await supabase.from("audit_logs").insert({
    actor_id: payload.actorId,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId || null,
    metadata: payload.metadata ?? {}
  });
}

async function saveLaunchChecklistResult(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: {
    id: string;
    label: string;
    category: string;
    status: "pending" | "passed" | "failed" | "blocked";
    notes: string;
  }
) {
  if (!supabase) {
    return;
  }

  await supabase.from("launch_checklist_items").upsert({
    id: input.id,
    label: input.label,
    category: input.category,
    status: input.status,
    notes: input.notes,
    checked_at: input.status === "pending" ? null : new Date().toISOString(),
    checked_by: input.status === "pending" ? null : userId,
    updated_at: new Date().toISOString()
  });
}

async function queueExternalNotification(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: {
    actorId: string;
    recipientUserId: string | null;
    subject: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string | null;
  }
) {
  if (!supabase || !payload.recipientUserId) {
    return;
  }

  const { data: recipientPhone } = await supabase.rpc("get_profile_phone_for_notification", {
    p_server_secret: getAutomationServerSecret(),
    p_user_id: payload.recipientUserId
  });

  await supabase.from("external_notification_outbox").insert({
    recipient_user_id: payload.recipientUserId,
    channel: "sms",
    destination: typeof recipientPhone === "string" ? recipientPhone : null,
    subject: payload.subject,
    body: payload.body,
    related_entity_type: payload.relatedEntityType ?? null,
    related_entity_id: payload.relatedEntityId ?? null,
    created_by: payload.actorId
  });
}

export async function createAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user) {
    redirect("/auth?next=/sell");
  }

  await assertActiveAccount(supabase, user.id);

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const categoryId = getString(formData, "category_id") || null;
  const location = getString(formData, "location") || "Lagos";
  const condition = getString(formData, "condition") || "good";
  const agentJobId = getString(formData, "agent_job_id") || null;
  const uploadedImageUrls = formData
    .getAll("uploaded_image_url")
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.startsWith("https://"))
    .slice(0, 6);
  const photos = formData
    .getAll("photos")
    .filter(isUsableImageFile)
    .slice(0, Math.max(0, 6 - uploadedImageUrls.length));
  const sellerPrice = Number(formData.get("seller_price") ?? 0);
  const durationHours = Number(formData.get("duration_hours") ?? 72);
  const coordinates = getOptionalNigeriaCoordinates(formData);
  const returnTo = safeNextPath(getString(formData, "return_to") || "/sell");
  const agentListingMode = getString(formData, "agent_listing_mode") === "1";

  if (coordinates.latitude === null || coordinates.longitude === null) {
    redirect(`${returnTo}?error=pickup-location`);
  }

  if (!title || !description || sellerPrice < 1) {
    redirect(`${returnTo}?error=missing-fields`);
  }

  let linkedAgentJobId: string | null = null;
  let listedForUserId: string | null = null;
  const [{ data: currentProfile }, { data: currentActivePremium }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("premium_subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .is("auction_id", null)
      .eq("plan", "premium_agent")
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle()
  ]);
  const currentUserIsAgent = canUseAgentDashboard(currentProfile?.role, currentActivePremium?.plan);

  if (currentUserIsAgent && !agentJobId) {
    redirect(`${returnTo}?error=agent-job`);
  }

  if (!currentUserIsAgent && agentListingMode) {
    redirect("/agent/apply");
  }

  if (agentJobId) {
    if (!currentUserIsAgent || !isUuid(agentJobId)) {
      redirect(`${returnTo}?error=agent-job`);
    }

    const { data: agentJob } = await supabase
      .from("agent_jobs")
      .select("id,agent_id,requester_id,status")
      .eq("id", agentJobId)
      .eq("agent_id", user.id)
      .maybeSingle();

    if (!agentJob || agentJob.status === "cancelled") {
      redirect(`${returnTo}?error=agent-job`);
    }

    linkedAgentJobId = agentJob.id;
    listedForUserId = agentJob.requester_id ?? null;
  }

  for (const photo of photos) {
    if (!ALLOWED_AUCTION_IMAGE_TYPES.has(photo.type)) {
      redirect(`${returnTo}?error=image-type`);
    }

    if (photo.size > MAX_AUCTION_IMAGE_BYTES) {
      redirect(`${returnTo}?error=image-size`);
    }
  }

  await upsertProfilePreservingAdmin(supabase, user.id, {
    full_name: user.email?.split("@")[0] ?? "Hazi Seller",
    verification_status: "pending",
    role: "seller"
  });

  const { data: auction, error } = await supabase
    .from("auctions")
    .insert({
      seller_id: user.id,
      agent_job_id: linkedAgentJobId,
      listed_for_user_id: listedForUserId,
      category_id: categoryId,
      title,
      description,
      condition,
      location,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      seller_price: sellerPrice,
      reserve_price: null,
      current_bid: Math.round(sellerPrice * 0.5),
      status: "active",
      pickup_available: formData.get("pickup_available") === "on",
      delivery_available: formData.get("delivery_available") === "on",
      ends_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
    })
    .select("id")
    .single();

  if (error || !auction) {
    redirect(`${returnTo}?error=publish-failed`);
  }

  const imageRows = [];

  for (const [position, photo] of photos.entries()) {
    const filePath = `${user.id}/${auction.id}/${crypto.randomUUID()}-${slugFileName(photo.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(AUCTION_IMAGE_BUCKET)
      .upload(filePath, photo, {
        cacheControl: "3600",
        contentType: photo.type,
        upsert: false
      });

    if (uploadError) {
      redirect(`${returnTo}?error=image-upload`);
    }

    const { data: publicUrl } = supabase.storage
      .from(AUCTION_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    imageRows.push({
      auction_id: auction.id,
      image_url: publicUrl.publicUrl,
      alt_text: title,
      position
    });
  }

  for (const uploadedImageUrl of uploadedImageUrls) {
    imageRows.push({
      auction_id: auction.id,
      image_url: uploadedImageUrl,
      alt_text: title,
      position: imageRows.length
    });
  }

  if (imageRows.length) {
    const { error: imageError } = await supabase.from("auction_images").insert(imageRows);

    if (imageError) {
      redirect(`${returnTo}?error=image-save`);
    }
  }

  if (listedForUserId) {
    await supabase.from("notifications").insert({
      user_id: listedForUserId,
      title: "Agent listed your item",
      body: `${title} has been published for auction by your assigned Hazi.ng agent.`,
      type: "agent_listing_created"
    });
  }

  revalidatePath("/");
  revalidatePath("/auctions");
  redirect(`/auctions/${auction.id}?posted=1`);
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const fullName = getString(formData, "full_name");
  const referralId = getString(formData, "referral_id") || null;

  if (!isStrongPassword(password)) {
    redirect(`/auth?mode=signup&error=${authRedirectParams("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getAppOrigin()}/dashboard`,
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    redirect(`/auth?error=${authRedirectParams(error.message)}`);
  }

  if (data.user) {
    await upsertProfilePreservingAdmin(supabase, data.user.id, {
      email: data.user.email?.toLowerCase() ?? email.toLowerCase(),
      full_name: fullName || email.split("@")[0],
      role: "buyer"
    });

    if (referralId && isUuid(referralId)) {
      await supabase.rpc("record_referral_registration", {
        p_server_secret: getAutomationServerSecret(),
        p_inviter_id: referralId,
        p_referred_user_id: data.user.id
      });
    }
  }

  if (!data.session) {
    redirect(`/auth?message=${authRedirectParams("Account created. Check your email to confirm your account, then sign in.")}`);
  }

  redirect("/dashboard");
}

export async function resendSignupConfirmation(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const email = getString(formData, "email");

  if (!email) {
    redirect(`/auth?error=${authRedirectParams("Enter your email address to resend confirmation.")}`);
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${await getAppOrigin()}/dashboard`
    }
  });

  if (error) {
    redirect(`/auth?error=${authRedirectParams(error.message)}`);
  }

  redirect(`/auth?message=${authRedirectParams("Confirmation email resent. Check your inbox and spam folder.")}`);
}

export async function sendPasswordRecovery(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const email = getString(formData, "email");
  const next = safeNextPath(getString(formData, "next") || "/dashboard");
  const emailParam = email ? `&email=${authRedirectParams(email)}` : "";
  const nextParam = `&next=${authRedirectParams(next)}`;

  if (!email) {
    redirect(`/auth/recover?error=${authRedirectParams("Enter your email address to receive a password recovery link.")}${nextParam}`);
  }

  const origin = await getAppOrigin();
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", `/auth/recover?reset=1&next=${encodeURIComponent(next)}`);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl.toString()
  });

  if (error) {
    redirect(`/auth/recover?error=${authRedirectParams(error.message)}${emailParam}${nextParam}`);
  }

  redirect(`/auth/recover?message=${authRedirectParams("Password recovery link sent. Check your inbox and spam folder.")}${emailParam}${nextParam}`);
}

export async function updateRecoveredPassword(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const password = getString(formData, "password");

  if (!isStrongPassword(password)) {
    redirect(`/auth/recover?reset=1&error=${authRedirectParams("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.")}`);
  }

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect(`/auth/recover?error=${authRedirectParams("Open the latest password recovery link from your email before setting a new password.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/recover?reset=1&error=${authRedirectParams(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect(`/auth?message=${authRedirectParams("Password updated. Sign in with your new password.")}`);
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const next = safeNextPath(getString(formData, "next") || "/dashboard");
  const origin = await getAppOrigin();
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error || !data.url) {
    redirect(`/auth?error=${authRedirectParams(error?.message ?? "Could not start Google sign in.")}&next=${authRedirectParams(next)}`);
  }

  redirect(data.url);
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const next = safeNextPath(getString(formData, "next") || "/dashboard");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    const message = error.message || "Could not sign in.";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("email not confirmed")) {
      redirect(
        `/auth?confirm_email=${authRedirectParams(email)}&error=${authRedirectParams("Confirm your email before signing in.")}&next=${authRedirectParams(next)}`
      );
    }

    if (lowerMessage.includes("invalid login credentials") || lowerMessage.includes("invalid credentials")) {
      redirect(`/auth?error=${authRedirectParams(message)}&recover=1&email=${authRedirectParams(email)}&next=${authRedirectParams(next)}`);
    }

    redirect(`/auth?error=${authRedirectParams(error.message)}&next=${authRedirectParams(next)}`);
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status,suspension_reason")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.account_status === "suspended") {
      await supabase.auth.signOut();
      redirect(`/auth?error=${authRedirectParams(profile.suspension_reason || "This account is suspended. Contact Hazi.ng support.")}`);
    }
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function placeBid(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=/auctions/${getString(formData, "auction_id")}`);
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const amount = Number(formData.get("amount") ?? 0);

  const { data: auctionForBid } = await supabase
    .from("auctions")
    .select("seller_id")
    .eq("id", auctionId)
    .maybeSingle();

  if (auctionForBid?.seller_id === user.id) {
    throw new Error("You cannot bid on your own listing.");
  }

  await upsertProfilePreservingAdmin(supabase, user.id, {
    full_name: user.email?.split("@")[0] ?? "Hazi Buyer",
    role: "buyer"
  });

  const { error } = await supabase.rpc("place_bid_secure", {
    p_auction_id: auctionId,
    p_amount: amount
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
  revalidatePath("/dashboard/notifications");
}

export async function withdrawBid(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/bids");
  }

  await assertActiveAccount(supabase, user.id);

  const bidId = getString(formData, "bid_id");
  const auctionId = getString(formData, "auction_id");

  const { error } = await supabase
    .from("bids")
    .update({ status: "withdrawn" })
    .eq("id", bidId)
    .eq("bidder_id", user.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/bids");
  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
}

export async function resolveBid(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth");
  }

  await assertActiveAccount(supabase, user.id);

  const bidId = getString(formData, "bid_id");
  const auctionId = getString(formData, "auction_id");
  const decision = getString(formData, "decision");

  const { error } = await supabase.rpc("resolve_bid", {
    p_bid_id: bidId,
    p_decision: decision
  });

  if (error) {
    throw new Error(error.message);
  }

  if (decision === "accepted") {
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id,buyer_id,seller_id,auctions(title)")
      .eq("auction_id", auctionId)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (transaction) {
      const starterMessage = "Bid accepted. Buyer funds are now held in escrow. Use this chat for pickup, delivery, and receipt confirmation.";
      const { count: starterMessageCount } = await supabase
        .from("transaction_messages")
        .select("*", { count: "exact", head: true })
        .eq("transaction_id", transaction.id)
        .eq("body", starterMessage);

      if (!starterMessageCount) {
        await supabase.from("transaction_messages").insert({
          transaction_id: transaction.id,
          sender_id: user.id,
          body: starterMessage
        });
      }

      const recipientId = transaction.buyer_id === user.id ? transaction.seller_id : transaction.buyer_id;
      const auction = Array.isArray(transaction.auctions) ? transaction.auctions[0] : transaction.auctions;

      await supabase.from("notifications").insert({
        user_id: recipientId,
        title: "Bid accepted - escrow chat is open",
        body: `Your bid for ${auction?.title ?? "an auction"} was accepted. Funds are held in escrow; open the chat to continue delivery.`,
        type: "escrow_message"
      });

      revalidatePath(`/transactions/${transaction.id}`);
      revalidatePath(`/auctions/${auctionId}`);
      revalidatePath("/auctions");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/notifications");
      redirect(`/transactions/${transaction.id}?accepted=1`);
    }
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function sendTransactionMessage(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth");
  }

  await assertActiveAccount(supabase, user.id);

  const transactionId = getString(formData, "transaction_id");
  const body = getString(formData, "body");

  if (!body) {
    throw new Error("Message cannot be empty.");
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,buyer_id,seller_id,auctions(title)")
    .eq("id", transactionId)
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message ?? "Transaction not found.");
  }

  if (![transaction.buyer_id, transaction.seller_id].includes(user.id)) {
    throw new Error("Only the buyer or seller can send escrow messages.");
  }

  await upsertProfilePreservingAdmin(supabase, user.id, {
    full_name: user.email?.split("@")[0] ?? "Hazi User",
    role: "buyer"
  });

  const { error } = await supabase.from("transaction_messages").insert({
    transaction_id: transactionId,
    sender_id: user.id,
    body
  });

  if (error) {
    throw new Error(error.message);
  }

  const recipientId = transaction.buyer_id === user.id ? transaction.seller_id : transaction.buyer_id;
  const auction = Array.isArray(transaction.auctions) ? transaction.auctions[0] : transaction.auctions;
  const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;

  await supabase.from("notifications").insert({
    user_id: recipientId,
    title: "New escrow message",
    body: `${user.email?.split("@")[0] ?? "A Hazi user"} sent a message about ${auction?.title ?? "your transaction"}: ${preview}`,
    type: "escrow_message"
  });

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function updateTransactionStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth");
  }

  await assertActiveAccount(supabase, user.id);

  const transactionId = getString(formData, "transaction_id");
  const nextStatus = getString(formData, "next_status");

  if (nextStatus === "paid") {
    throw new Error("Submit payment proof for admin review instead of marking paid directly.");
  }

  const { error } = await supabase.rpc("update_transaction_status", {
    p_transaction_id: transactionId,
    p_next_status: nextStatus
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `transaction_${nextStatus}`,
    entityType: "transaction",
    entityId: transactionId,
    metadata: { next_status: nextStatus }
  });

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/audit");
  revalidatePath("/dashboard/notifications");
}

export async function confirmSellerDelivery(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id,seller_id,buyer_id,status,seller_delivery_started_at")
    .eq("id", transactionId)
    .single();

  if (!transaction || transaction.seller_id !== user.id) {
    throw new Error("Only the seller can mark delivery as started.");
  }

  if (transaction.status !== "paid") {
    throw new Error("Delivery can only start after escrow is funded.");
  }

  if (transaction.seller_delivery_started_at) {
    throw new Error("Delivery has already been marked as started.");
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      seller_delivery_started_at: new Date().toISOString()
    })
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("notifications").insert({
    user_id: transaction.buyer_id,
    title: "Item is on the way",
    body: "The seller has marked this item as on the way. Confirm receipt after you have received and checked it.",
    type: "escrow_delivery_started"
  });

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard/notifications");
}

export async function confirmBuyerReceipt(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const { error: receiptError } = await supabase
    .from("transactions")
    .update({ buyer_received_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("buyer_id", user.id)
    .eq("status", "paid");

  if (receiptError) {
    throw new Error(receiptError.message);
  }

  const { error } = await supabase.rpc("update_transaction_status", {
    p_transaction_id: transactionId,
    p_next_status: "released"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
}

export async function submitDisputeEvidence(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const notes = getString(formData, "notes");
  const evidenceFile = formData.get("evidence_file");
  let fileUrl: string | null = null;
  let fileName: string | null = null;

  if (isUsableFile(evidenceFile)) {
    if (!ALLOWED_DISPUTE_EVIDENCE_TYPES.has(evidenceFile.type)) {
      throw new Error("Evidence must be JPEG, PNG, WebP, or PDF.");
    }

    if (evidenceFile.size > MAX_DISPUTE_EVIDENCE_BYTES) {
      throw new Error("Evidence must be 10MB or smaller.");
    }

    const filePath = `${user.id}/${transactionId}/${crypto.randomUUID()}-${slugFileName(evidenceFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(DISPUTE_EVIDENCE_BUCKET)
      .upload(filePath, evidenceFile, {
        cacheControl: "3600",
        contentType: evidenceFile.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    fileUrl = filePath;
    fileName = evidenceFile.name;
  }

  if (!notes && !fileUrl) {
    throw new Error("Add a note or upload evidence.");
  }

  const { error } = await supabase.from("dispute_evidence").insert({
    transaction_id: transactionId,
    submitted_by: user.id,
    evidence_type: fileUrl ? "file" : "note",
    file_url: fileUrl,
    file_name: fileName,
    notes
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath(`/admin/disputes/${transactionId}`);
}

export async function submitPaymentProof(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const reference = getString(formData, "reference") || null;
  const method = getString(formData, "method") || "bank_transfer";
  const proofFile = formData.get("proof_file");

  if (!isUsableFile(proofFile)) {
    throw new Error("Upload a JPEG, PNG, WebP, or PDF payment proof.");
  }

  if (!ALLOWED_PAYMENT_PROOF_TYPES.has(proofFile.type)) {
    throw new Error("Payment proof must be JPEG, PNG, WebP, or PDF.");
  }

  if (proofFile.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error("Payment proof must be 10MB or smaller.");
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,buyer_id,amount,status")
    .eq("id", transactionId)
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message ?? "Transaction not found.");
  }

  if (transaction.buyer_id !== user.id) {
    throw new Error("Only the buyer can submit payment proof.");
  }

  if (transaction.status !== "escrow_pending") {
    throw new Error("Payment proof can only be submitted while escrow is pending.");
  }

  const { data: existingPayment } = await supabase
    .from("transaction_payments")
    .select("id,status")
    .eq("transaction_id", transactionId)
    .in("status", ["pending", "verified"])
    .maybeSingle();

  if (existingPayment) {
    throw new Error(existingPayment.status === "verified" ? "This payment is already verified." : "A payment proof is already waiting for review.");
  }

  const filePath = `${user.id}/${transactionId}/${crypto.randomUUID()}-${slugFileName(proofFile.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(filePath, proofFile, {
      cacheControl: "3600",
      contentType: proofFile.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error } = await supabase.from("transaction_payments").insert({
    transaction_id: transactionId,
    payer_id: user.id,
    amount: transaction.amount,
    method,
    reference,
    proof_url: filePath,
    proof_name: proofFile.name,
    status: "pending"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
}

export async function startFlutterwavePayment(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  if (!isFlutterwaveConfigured()) {
    throw new Error("Flutterwave is not configured yet.");
  }

  const transactionId = getString(formData, "transaction_id");
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,buyer_id,seller_id,amount,status,auction_id,auctions(title)")
    .eq("id", transactionId)
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message ?? "Transaction not found.");
  }

  if (transaction.buyer_id !== user.id) {
    throw new Error("Only the buyer can pay for this transaction.");
  }

  if (transaction.status !== "escrow_pending") {
    throw new Error("Flutterwave payment can only start while escrow is pending.");
  }

  const { data: existingPayment } = await supabase
    .from("transaction_payments")
    .select("id,status")
    .eq("transaction_id", transactionId)
    .in("status", ["pending", "verified"])
    .maybeSingle();

  if (existingPayment) {
    throw new Error(existingPayment.status === "verified" ? "This payment is already verified." : "A payment is already waiting for completion.");
  }

  const origin = await getAppOrigin();
  const txRef = `hazi-${transactionId}-${crypto.randomUUID()}`;
  const auction = Array.isArray(transaction.auctions) ? transaction.auctions[0] : transaction.auctions;
  const checkoutUrl = await initializeFlutterwavePayment({
    txRef,
    amount: Number(transaction.amount),
    redirectUrl: `${origin}/payments/flutterwave/callback`,
    customer: {
      email: user.email ?? "buyer@hazi.ng",
      name: user.email?.split("@")[0] ?? "Hazi buyer"
    },
    title: auction?.title ?? "Accepted auction"
  });

  const { error } = await supabase.from("transaction_payments").insert({
    transaction_id: transactionId,
    payer_id: user.id,
    amount: transaction.amount,
    method: "flutterwave",
    reference: txRef,
    proof_url: null,
    proof_name: null,
    status: "pending"
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(checkoutUrl);
}

export async function startWalletFunding(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  if (!isFlutterwaveConfigured()) {
    redirect("/dashboard/wallet?error=flutterwave");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/wallet");
  }

  await assertActiveAccount(supabase, user.id);

  const amount = Number(formData.get("amount") ?? 0);

  if (!Number.isFinite(amount) || amount < 100) {
    redirect("/dashboard/wallet?error=amount");
  }

  const origin = await getAppOrigin();
  const txRef = `hazi-wallet-${crypto.randomUUID()}`;
  const { data: intentId, error } = await supabase.rpc("create_wallet_funding_intent", {
    p_amount: amount,
    p_tx_ref: txRef
  });

  if (error || !intentId) {
    throw new Error(error?.message ?? "Could not create wallet funding request.");
  }

  const checkoutUrl = await initializeFlutterwavePayment({
    txRef,
    amount,
    redirectUrl: `${origin}/payments/flutterwave/callback?purpose=wallet&wallet_intent_id=${intentId}`,
    customer: {
      email: user.email ?? "wallet@hazi.ng",
      name: user.email?.split("@")[0] ?? "Hazi wallet"
    },
    title: "Hazi.ng wallet funding"
  });

  redirect(checkoutUrl);
}

export async function payEscrowFromWallet(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const transactionId = getString(formData, "transaction_id");
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const { error } = await supabase.rpc("pay_transaction_from_wallet", {
    p_transaction_id: transactionId
  });

  if (error) {
    redirect(`/transactions/${transactionId}?wallet_error=${authRedirectParams(error.message)}`);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/orders");
  redirect(`/transactions/${transactionId}?wallet_paid=1`);
}

export async function startPremiumSubscription(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/premium");
  }

  await assertActiveAccount(supabase, user.id);

  const plan = getString(formData, "plan") as keyof typeof PREMIUM_PLANS;
  const auctionId = getString(formData, "auction_id");
  const boostPlan = getString(formData, "boost_plan") || "listing_boost_7d";
  const premiumPlan = PREMIUM_PLANS[plan];

  if (!premiumPlan) {
    redirect("/premium?error=plan");
  }

  if (boostPlan && !LISTING_BOOST_PLANS.has(boostPlan)) {
    redirect("/premium?error=boost-plan");
  }

  if (auctionId) {
    const { data: auction } = await supabase
      .from("auctions")
      .select("id,seller_id,status")
      .eq("id", auctionId)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (!auction || !["active", "paused"].includes(auction.status)) {
      redirect("/premium?error=auction");
    }
  }

  if (!isFlutterwaveConfigured()) {
    redirect(`/premium?error=payment${auctionId ? `&auction_id=${auctionId}` : ""}&boost_plan=${boostPlan}`);
  }

  const origin = await getAppOrigin();
  const txRef = `hazi-premium-${crypto.randomUUID()}`;
  const { error: intentError } = await supabase.from("provider_payment_intents").insert({
    user_id: user.id,
    purpose: "premium_subscription",
    provider: "flutterwave",
    reference: txRef,
    amount: premiumPlan.amount,
    currency: "NGN",
    plan,
    auction_id: auctionId || null,
    boost_plan: boostPlan,
    status: "pending"
  });

  if (intentError) {
    throw new Error(intentError.message);
  }

  const checkoutUrl = await initializeFlutterwavePayment({
    txRef,
    amount: premiumPlan.amount,
    redirectUrl: `${origin}/payments/flutterwave/callback?purpose=premium&plan=${plan}${auctionId ? `&auction_id=${auctionId}` : ""}&boost_plan=${boostPlan}`,
    customer: {
      email: user.email ?? "seller@hazi.ng",
      name: user.email?.split("@")[0] ?? "Hazi seller"
    },
    title: `Hazi.ng ${premiumPlan.label}`
  });

  redirect(checkoutUrl);
}

export async function requestWalletWithdrawal(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/wallet");
  }

  await assertActiveAccount(supabase, user.id);

  const amount = Number(formData.get("amount") ?? 0);
  const sourceBucket = getString(formData, "source_bucket") || "earnings";
  const bankName = getString(formData, "bank_name");
  const accountNumber = getString(formData, "account_number");
  const accountName = getString(formData, "account_name");
  const bankCode = getString(formData, "bank_code") || null;

  const { error } = await supabase.rpc("request_wallet_withdrawal", {
    p_amount: amount,
    p_source_bucket: sourceBucket,
    p_bank_name: bankName,
    p_account_number: accountNumber,
    p_account_name: accountName,
    p_bank_code: bankCode
  });

  if (error) {
    redirect(`/dashboard/wallet?withdrawal_error=${authRedirectParams(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/admin");
  revalidatePath("/admin/payouts");
  redirect("/dashboard/wallet?withdrawal=requested");
}

export async function reviewWalletWithdrawal(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/payouts");

  const withdrawalId = getString(formData, "withdrawal_id");
  const decision = getString(formData, "decision");
  const providerReference = getString(formData, "provider_reference") || null;
  const adminNotes = getString(formData, "admin_notes") || null;

  const { error } = await supabase.rpc("review_wallet_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_decision: decision,
    p_provider_reference: providerReference,
    p_admin_notes: adminNotes,
    p_provider: decision === "approved" ? "manual_payout" : null
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `withdrawal_${decision}`,
    entityType: "withdrawal_request",
    entityId: withdrawalId,
    metadata: { provider_reference: providerReference, notes: adminNotes }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/payouts");
  revalidatePath("/dashboard/wallet");
}

export async function executeFlutterwaveWithdrawal(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/payouts");
  const withdrawalId = getString(formData, "withdrawal_id");

  if (!isFlutterwaveConfigured()) {
    redirect("/admin/payouts?payout_error=flutterwave_not_configured");
  }

  const { data: withdrawal, error: readError } = await supabase
    .from("withdrawal_requests")
    .select("id,user_id,amount,currency,source_bucket,bank_name,bank_code,account_number,account_name,status")
    .eq("id", withdrawalId)
    .single();

  if (readError || !withdrawal) {
    throw new Error(readError?.message ?? "Withdrawal request not found.");
  }

  if (withdrawal.status !== "pending") {
    throw new Error("Withdrawal has already been reviewed.");
  }

  if (!withdrawal.bank_code) {
    redirect("/admin/payouts?payout_error=missing_bank_code");
  }

  const amount = Number(withdrawal.amount ?? 0);
  const transferReference = `hazi-payout-${withdrawal.id}`;
  let transfer: Awaited<ReturnType<typeof createFlutterwaveTransfer>>;

  try {
    transfer = await createFlutterwaveTransfer({
      accountBank: withdrawal.bank_code,
      accountNumber: withdrawal.account_number,
      amount,
      narration: "Hazi.ng wallet withdrawal",
      reference: transferReference,
      beneficiaryName: withdrawal.account_name
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flutterwave transfer failed.";
    await recordAuditLog(supabase, {
      actorId: user.id,
      action: "withdrawal_flutterwave_failed",
      entityType: "withdrawal_request",
      entityId: withdrawal.id,
      metadata: { message }
    });
    redirect(`/admin/payouts?payout_error=${authRedirectParams(message)}`);
  }

  const { error } = await supabase.rpc("review_wallet_withdrawal", {
    p_withdrawal_id: withdrawal.id,
    p_decision: "approved",
    p_provider_reference: transfer.reference,
    p_admin_notes: `Flutterwave transfer accepted. Transfer ID: ${transfer.id}. Status: ${transfer.status}.`,
    p_provider: "flutterwave_transfer"
  });

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("finance_settlements").insert({
    settlement_type: "wallet_withdrawal",
    provider: "flutterwave_transfer",
    provider_reference: transfer.reference,
    gross_amount: amount,
    fee_amount: 0,
    net_amount: amount,
    currency: withdrawal.currency || "NGN",
    status: transfer.status,
    related_entity_type: "withdrawal_request",
    related_entity_id: withdrawal.id,
    metadata: {
      transfer_id: transfer.id,
      source_bucket: withdrawal.source_bucket,
      bank_name: withdrawal.bank_name,
      bank_code: withdrawal.bank_code
    }
  });

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "withdrawal_flutterwave_transfer_created",
    entityType: "withdrawal_request",
    entityId: withdrawal.id,
    metadata: {
      provider_reference: transfer.reference,
      transfer_id: transfer.id,
      amount
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/finance");
  revalidatePath("/dashboard/wallet");
  redirect("/admin/payouts?payout=flutterwave_started");
}

export async function reviewPaymentProof(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/payments");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(adminProfile?.role)) {
    redirect("/dashboard");
  }

  const paymentId = getString(formData, "payment_id");
  const decision = getString(formData, "decision");
  const notes = getString(formData, "review_notes");
  const nextStatus = decision === "verified" ? "verified" : "rejected";

  if (!["verified", "rejected"].includes(nextStatus)) {
    throw new Error("Unsupported payment review decision.");
  }

  const { data: payment, error: readError } = await supabase
    .from("transaction_payments")
    .select("id,transaction_id,payer_id,status")
    .eq("id", paymentId)
    .single();

  if (readError || !payment) {
    throw new Error(readError?.message ?? "Payment proof not found.");
  }

  const { error } = await supabase
    .from("transaction_payments")
    .update({
      status: nextStatus,
      reviewer_id: user.id,
      review_notes: notes || null,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", paymentId);

  if (error) {
    throw new Error(error.message);
  }

  if (nextStatus === "verified") {
    const { error: statusError } = await supabase.rpc("update_transaction_status", {
      p_transaction_id: payment.transaction_id,
      p_next_status: "paid"
    });

    if (statusError) {
      throw new Error(statusError.message);
    }
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `payment_${nextStatus}`,
    entityType: "transaction_payment",
    entityId: paymentId,
    metadata: {
      transaction_id: payment.transaction_id,
      decision: nextStatus,
      notes: notes || null
    }
  });

  await queueExternalNotification(supabase, {
    actorId: user.id,
    recipientUserId: payment.payer_id,
    subject: nextStatus === "verified" ? "Hazi.ng payment verified" : "Hazi.ng payment proof rejected",
    body: nextStatus === "verified"
      ? "Your payment proof has been verified. You can now coordinate delivery or pickup."
      : notes || "Your payment proof was rejected. Please upload a clearer receipt or contact support.",
    relatedEntityType: "transaction_payment",
    relatedEntityId: paymentId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/payments");
  revalidatePath(`/transactions/${payment.transaction_id}`);
  revalidatePath("/dashboard");
}

export async function resolveDispute(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin");
  }

  const transactionId = getString(formData, "transaction_id");
  const resolution = getString(formData, "resolution");

  const { error } = await supabase.rpc("resolve_disputed_transaction", {
    p_transaction_id: transactionId,
    p_resolution: resolution
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `dispute_${resolution}`,
    entityType: "transaction",
    entityId: transactionId,
    metadata: { resolution }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard/notifications");
}

export async function submitReport(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const auctionId = getString(formData, "auction_id");

  if (!user) {
    redirect(`/auth?next=/auctions/${auctionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const reportedUserId = getString(formData, "reported_user_id") || null;
  const reason = getString(formData, "reason");
  const details = getString(formData, "details");

  if (!reason) {
    throw new Error("Choose a reason before sending a report.");
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    auction_id: auctionId || null,
    reported_user_id: reportedUserId,
    reason,
    details,
    status: "open"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(`/auctions/${auctionId}?reported=1`);
}

export async function resolveReport(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/reports");
  }

  const reportId = getString(formData, "report_id");
  const status = getString(formData, "status");

  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: reportId,
    p_status: status
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `report_${status}`,
    entityType: "report",
    entityId: reportId,
    metadata: { status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/reports");
}

export async function updateUserModerationStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/users");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(adminProfile?.role)) {
    redirect("/dashboard");
  }

  const targetUserId = getString(formData, "user_id");
  const status = getString(formData, "account_status");
  const reason = getString(formData, "suspension_reason");
  const allowedStatuses = new Set(["active", "suspended"]);

  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported account status.");
  }

  if (targetUserId === user.id && status === "suspended") {
    throw new Error("Admins cannot suspend their own account.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: status,
      suspension_reason: status === "suspended" ? reason || "Suspended by admin review." : null,
      suspended_at: status === "suspended" ? new Date().toISOString() : null,
      suspended_by: status === "suspended" ? user.id : null
    })
    .eq("id", targetUserId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: status === "suspended" ? "user_suspended" : "user_reactivated",
    entityType: "profile",
    entityId: targetUserId,
    metadata: {
      account_status: status,
      reason: status === "suspended" ? reason || "Suspended by admin review." : null
    }
  });

  await queueExternalNotification(supabase, {
    actorId: user.id,
    recipientUserId: targetUserId,
    subject: status === "suspended" ? "Hazi.ng account suspended" : "Hazi.ng account reactivated",
    body: status === "suspended"
      ? reason || "Your Hazi.ng account was suspended after admin review."
      : "Your Hazi.ng account has been reactivated.",
    relatedEntityType: "profile",
    relatedEntityId: targetUserId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
  revalidatePath("/dashboard");
}

export async function updateUserRole(formData: FormData) {
  const { supabase, user, profile: actorProfile } = await requireAdminAction("/admin/users");
  const targetUserId = getString(formData, "user_id");
  const role = getString(formData, "role");

  if (!isSuperAdminRole(actorProfile?.role)) {
    throw new Error("Only the superadmin can assign user roles.");
  }

  if (!targetUserId || !isUuid(targetUserId)) {
    throw new Error("Choose a valid user before assigning a role.");
  }

  if (!ASSIGNABLE_PROFILE_ROLES.has(role)) {
    throw new Error("Choose a valid user role.");
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", targetUserId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "user_role_updated",
    entityType: "profile",
    entityId: targetUserId,
    metadata: {
      previous_role: targetProfile?.role ?? null,
      next_role: role
    }
  });

  await queueExternalNotification(supabase, {
    actorId: user.id,
    recipientUserId: targetUserId,
    subject: "Hazi.ng role updated",
    body: `Your Hazi.ng account role is now ${role}.`,
    relatedEntityType: "profile",
    relatedEntityId: targetUserId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
  redirect("/admin/users?role_updated=1");
}

export async function grantFreePremiumSubscription(formData: FormData) {
  const { supabase, user, profile } = await requireAdminAction("/admin/users");
  const targetUserId = getString(formData, "user_id");
  const plan = getString(formData, "plan") as keyof typeof PREMIUM_PLANS;
  const duration = getString(formData, "duration_days") || "30";
  const premiumPlan = PREMIUM_PLANS[plan];
  const allowedDurations = new Set(["30", "90", "365", "lifetime"]);

  if (!isSuperAdminRole(profile?.role)) {
    throw new Error("Only a superadmin can grant free premium packages.");
  }

  if (!targetUserId || !isUuid(targetUserId)) {
    throw new Error("Choose a valid user before granting premium.");
  }

  if (!premiumPlan) {
    throw new Error("Choose a valid premium package.");
  }

  if (!allowedDurations.has(duration)) {
    throw new Error("Choose a valid premium duration.");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const endsAt = duration === "lifetime"
    ? null
    : new Date(now.getTime() + Number(duration) * 24 * 60 * 60 * 1000).toISOString();

  const { error: replaceError } = await supabase
    .from("premium_subscriptions")
    .update({
      status: "replaced",
      ends_at: nowIso
    })
    .eq("user_id", targetUserId)
    .is("auction_id", null)
    .eq("status", "active")
    .in("plan", Object.keys(PREMIUM_PLANS));

  if (replaceError) {
    throw new Error(replaceError.message);
  }

  const { error } = await supabase.from("premium_subscriptions").insert({
    user_id: targetUserId,
    plan,
    status: "active",
    starts_at: nowIso,
    ends_at: endsAt,
    auction_id: null,
    amount: 0,
    currency: "NGN",
    provider: "admin_free",
    provider_reference: `admin-free-${crypto.randomUUID()}`,
    metadata: {
      granted_by: user.id,
      grant_type: "free_admin_premium",
      package_label: premiumPlan.label,
      duration_days: duration === "lifetime" ? null : Number(duration)
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "premium_granted_free",
    entityType: "profile",
    entityId: targetUserId,
    metadata: {
      plan,
      duration_days: duration === "lifetime" ? null : Number(duration),
      ends_at: endsAt
    }
  });

  await queueExternalNotification(supabase, {
    actorId: user.id,
    recipientUserId: targetUserId,
    subject: "Hazi.ng premium activated",
    body: `An admin activated ${premiumPlan.label} on your account for free.`,
    relatedEntityType: "premium_subscription",
    relatedEntityId: targetUserId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  redirect("/admin/users?premium=granted");
}

export async function updateExternalNotificationStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/notifications");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(adminProfile?.role)) {
    redirect("/dashboard");
  }

  const notificationId = getString(formData, "notification_id");
  const status = getString(formData, "status");
  const allowedStatuses = new Set(["queued", "sent", "failed", "cancelled"]);

  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported notification status.");
  }

  const { error } = await supabase
    .from("external_notification_outbox")
    .update({
      status,
      provider: status === "queued" ? null : getString(formData, "provider") || null,
      provider_message_id: status === "queued" ? null : getString(formData, "provider_message_id") || null,
      failure_reason: status === "failed" ? getString(formData, "failure_reason") || "Manual send failed." : null,
      sent_at: status === "sent" ? new Date().toISOString() : null
    })
    .eq("id", notificationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `external_notification_${status}`,
    entityType: "external_notification",
    entityId: notificationId,
    metadata: { status }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
}

export async function updateLaunchChecklistItem(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/health");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  const id = getString(formData, "id");
  const label = getString(formData, "label");
  const category = getString(formData, "category") || "launch";
  const status = getString(formData, "status");
  const notes = getString(formData, "notes") || null;
  const allowedStatuses = new Set(["pending", "passed", "failed", "blocked"]);

  if (!id || !label || !allowedStatuses.has(status)) {
    throw new Error("Invalid launch checklist update.");
  }

  const { error } = await supabase.from("launch_checklist_items").upsert({
    id,
    label,
    category,
    status,
    notes,
    checked_at: status === "pending" ? null : new Date().toISOString(),
    checked_by: status === "pending" ? null : user.id,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "launch_checklist_updated",
    entityType: "launch_checklist_item",
    entityId: null,
    metadata: {
      item_id: id,
      status,
      category
    }
  });

  revalidatePath("/admin/health");
  revalidatePath("/admin/audit");
}

export async function startFlutterwaveLaunchTest(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/health");
  const email = getString(formData, "email");
  const amount = Math.max(100, Number(formData.get("amount") ?? 1000));

  if (!isFlutterwaveConfigured()) {
    await saveLaunchChecklistResult(supabase, user.id, {
      id: "flutterwave_live_payment",
      label: "Full Flutterwave live payment test",
      category: "payments",
      status: "blocked",
      notes: "Flutterwave keys are missing."
    });
    redirect("/admin/health?test_error=flutterwave_not_configured");
  }

  if (!email) {
    redirect("/admin/health?test_error=missing_test_email");
  }

  const txRef = `launch-flw-${Date.now()}`;
  let checkoutUrl = "";

  try {
    checkoutUrl = await initializeFlutterwavePayment({
      txRef,
      amount,
      redirectUrl: `${getCanonicalProductionOrigin()}/payments/flutterwave/callback?purpose=launch_test`,
      customer: {
        email,
        name: "Hazi.ng launch test"
      },
      title: "Hazi.ng Flutterwave launch test"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Flutterwave launch test.";
    await saveLaunchChecklistResult(supabase, user.id, {
      id: "flutterwave_live_payment",
      label: "Full Flutterwave live payment test",
      category: "payments",
      status: "failed",
      notes: message
    });
    redirect(`/admin/health?test_error=${authRedirectParams(message)}`);
  }

  await saveLaunchChecklistResult(supabase, user.id, {
    id: "flutterwave_live_payment",
    label: "Full Flutterwave live payment test",
    category: "payments",
    status: "pending",
    notes: `Checkout started for ${email} with reference ${txRef}. Complete payment and confirm callback/webhook reconciliation.`
  });

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "launch_flutterwave_checkout_started",
    entityType: "launch_checklist_item",
    entityId: null,
    metadata: { reference: txRef, amount }
  });

  redirect(checkoutUrl);
}

export async function runFlutterwaveWebhookSmokeTest() {
  const { supabase, user } = await requireAdminAction("/admin/health");
  const reference = `launch-webhook-${Date.now()}`;

  try {
    const serverSecret = getAutomationServerSecret();
    const payload = {
      source: "admin_health_smoke_test",
      reference
    };

    const first = await supabase.rpc("complete_provider_payment_reference", {
      p_provider: "flutterwave",
      p_reference: reference,
      p_provider_transaction_id: "",
      p_verified_amount: 100,
      p_currency: "NGN",
      p_provider_status: "failed",
      p_event_id: reference,
      p_payload: payload,
      p_server_secret: serverSecret
    });

    if (first.error) {
      throw new Error(first.error.message);
    }

    const duplicate = await supabase.rpc("complete_provider_payment_reference", {
      p_provider: "flutterwave",
      p_reference: reference,
      p_provider_transaction_id: "",
      p_verified_amount: 100,
      p_currency: "NGN",
      p_provider_status: "failed",
      p_event_id: reference,
      p_payload: payload,
      p_server_secret: serverSecret
    });

    if (duplicate.error) {
      throw new Error(duplicate.error.message);
    }

    await saveLaunchChecklistResult(supabase, user.id, {
      id: "flutterwave_webhooks",
      label: "Flutterwave webhook scenarios",
      category: "payments",
      status: "passed",
      notes: `Smoke-tested failed webhook and duplicate event idempotency with reference ${reference}. Live successful/abandoned provider events still need real Flutterwave dashboard validation.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flutterwave webhook smoke test failed.";
    await saveLaunchChecklistResult(supabase, user.id, {
      id: "flutterwave_webhooks",
      label: "Flutterwave webhook scenarios",
      category: "payments",
      status: "failed",
      notes: message
    });
    redirect(`/admin/health?test_error=${authRedirectParams(message)}`);
  }

  revalidatePath("/admin/health");
  redirect("/admin/health?test=flutterwave_webhook_smoke_passed");
}

export async function sendLaunchNotificationTest(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/health");
  const channel = getString(formData, "channel");
  const destination = getString(formData, "destination");
  const isEmail = channel === "email";
  const checklistId = isEmail ? "resend_live_email" : "termii_live_sms";
  const label = isEmail ? "Resend live email sending" : "Termii live SMS sending";

  if (!["email", "sms"].includes(channel) || !destination) {
    redirect("/admin/health?test_error=missing_notification_destination");
  }

  try {
    const result = await sendExternalNotification({
      id: `launch-${crypto.randomUUID()}`,
      channel,
      destination,
      subject: "Hazi.ng launch notification test",
      body: "This is a Hazi.ng launch readiness test message."
    });

    await saveLaunchChecklistResult(supabase, user.id, {
      id: checklistId,
      label,
      category: "notifications",
      status: "passed",
      notes: `${result.provider} accepted the test message. Provider message ID: ${result.providerMessageId}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification provider test failed.";
    await saveLaunchChecklistResult(supabase, user.id, {
      id: checklistId,
      label,
      category: "notifications",
      status: "failed",
      notes: message
    });
    redirect(`/admin/health?test_error=${authRedirectParams(message)}`);
  }

  revalidatePath("/admin/health");
  redirect(`/admin/health?test=${isEmail ? "resend" : "termii"}_checked`);
}

export async function requestDeliveryQuote(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,auction_id,buyer_id,seller_id")
    .eq("id", transactionId)
    .eq("auction_id", auctionId)
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message ?? "Transaction not found.");
  }

  if (![transaction.buyer_id, transaction.seller_id].includes(user.id)) {
    throw new Error("Only transaction participants can request delivery quotes.");
  }

  const [{ data: auction }, { data: buyer }, { data: seller }] = await Promise.all([
    supabase
      .from("auctions")
      .select("id,location,latitude,longitude")
      .eq("id", auctionId)
      .single(),
    supabase
      .from("public_profiles")
      .select("id,location,latitude,longitude")
      .eq("id", transaction.buyer_id)
      .single(),
    supabase
      .from("public_profiles")
      .select("id,location,latitude,longitude")
      .eq("id", transaction.seller_id)
      .single()
  ]);

  const pickupLocation = getString(formData, "pickup_location") || auction?.location || seller?.location || "";
  const dropoffLocation = getString(formData, "dropoff_location") || buyer?.location || "";
  const sellerCoordinates = hasCoordinates(auction)
    ? { latitude: auction.latitude, longitude: auction.longitude }
    : hasCoordinates(seller)
      ? { latitude: seller.latitude, longitude: seller.longitude }
      : null;
  const buyerCoordinates = hasCoordinates(buyer)
    ? { latitude: buyer.latitude, longitude: buyer.longitude }
    : null;
  const automaticEstimate = sellerCoordinates && buyerCoordinates
    ? getDeliveryEstimate(sellerCoordinates, buyerCoordinates)
    : null;
  const submittedDistance = Number(formData.get("distance_km") ?? 0);
  const distanceKm = Number.isFinite(submittedDistance) && submittedDistance > 0
    ? Math.max(1, submittedDistance)
    : automaticEstimate?.distanceKm ?? 0;
  const fallbackFee = automaticEstimate?.estimatedFee ?? Math.round(2000 + distanceKm * 450);

  if (!pickupLocation || !dropoffLocation || !distanceKm) {
    throw new Error("Buyer and seller saved locations are required before Hazi.ng can suggest delivery.");
  }

  const aiEstimate = await getAiDeliveryEstimate({
    pickupLocation,
    dropoffLocation,
    distanceKm,
    fallbackFee
  });

  const { error } = await supabase.from("delivery_quotes").insert({
    auction_id: auctionId,
    requester_id: user.id,
    provider: "Independent delivery",
    provider_quote_id: null,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    distance_km: distanceKm,
    estimated_fee: aiEstimate.fee,
    currency: "NGN",
    raw_response: aiEstimate.raw,
    status: aiEstimate.source === "openrouter" ? "ai_estimate" : "fallback_quote"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
}

export async function bookDeliveryOrder(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const quoteId = getString(formData, "quote_id");

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,auction_id,buyer_id,seller_id,status")
    .eq("id", transactionId)
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message ?? "Transaction not found.");
  }

  if (transaction.status !== "paid") {
    throw new Error("Delivery can only be booked after payment is verified.");
  }

  if (![transaction.buyer_id, transaction.seller_id].includes(user.id)) {
    throw new Error("Only transaction participants can book delivery.");
  }

  const { data: existingOrder } = await supabase
    .from("delivery_orders")
    .select("id")
    .eq("transaction_id", transactionId)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingOrder) {
    throw new Error("Delivery is already booked for this transaction.");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("delivery_quotes")
    .select("id,auction_id,provider,provider_quote_id,pickup_location,dropoff_location,distance_km,estimated_fee")
    .eq("id", quoteId)
    .eq("auction_id", transaction.auction_id)
    .single();

  if (quoteError || !quote) {
    throw new Error(quoteError?.message ?? "Delivery quote not found.");
  }

  const { error } = await supabase.from("delivery_orders").insert({
    transaction_id: transactionId,
    quote_id: quote.id,
    auction_id: quote.auction_id,
    requester_id: user.id,
    provider: quote.provider,
    provider_shipment_id: null,
    provider_tracking_url: null,
    raw_response: { mode: "independent_delivery", instruction: "Buyer and seller arrange a delivery agent independently." },
    pickup_location: quote.pickup_location,
    dropoff_location: quote.dropoff_location,
    distance_km: quote.distance_km,
    fee: quote.estimated_fee,
    status: "assigned",
    tracking_code: `HAZI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    courier_name: null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/deliveries");
}

export async function updateDeliveryOrder(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/deliveries");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(adminProfile?.role)) {
    redirect("/dashboard");
  }

  const deliveryId = getString(formData, "delivery_id");
  const status = getString(formData, "status");
  const allowedStatuses = new Set(["booked", "assigned", "picked_up", "in_transit", "delivered", "cancelled", "exception"]);

  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported delivery status.");
  }

  const { data: delivery, error: readError } = await supabase
    .from("delivery_orders")
    .select("id,status,transaction_id,transactions(id,buyer_id,seller_id)")
    .eq("id", deliveryId)
    .single();

  if (readError || !delivery) {
    throw new Error(readError?.message ?? "Delivery order not found.");
  }

  const { error } = await supabase
    .from("delivery_orders")
    .update({
      status: status === "exception" ? delivery.status : status,
      courier_name: getString(formData, "courier_name") || null,
      courier_phone: getString(formData, "courier_phone") || null,
      notes: getString(formData, "notes") || null,
      exception_reason: status === "exception" ? getString(formData, "exception_reason") || "Admin marked delivery exception." : null,
      cancellation_reason: status === "cancelled" ? getString(formData, "cancellation_reason") || "Cancelled by admin." : null,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
      delivered_at: status === "delivered" ? new Date().toISOString() : null
    })
    .eq("id", deliveryId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `delivery_${status}`,
    entityType: "delivery_order",
    entityId: deliveryId,
    metadata: {
      transaction_id: delivery.transaction_id,
      status
    }
  });

  const transaction = Array.isArray(delivery.transactions) ? delivery.transactions[0] : delivery.transactions;
  const deliveryMessage = `Your Hazi.ng delivery is now ${status.replaceAll("_", " ")}.`;

  await Promise.all([
    queueExternalNotification(supabase, {
      actorId: user.id,
      recipientUserId: transaction?.buyer_id ?? null,
      subject: "Hazi.ng delivery update",
      body: deliveryMessage,
      relatedEntityType: "delivery_order",
      relatedEntityId: deliveryId
    }),
    queueExternalNotification(supabase, {
      actorId: user.id,
      recipientUserId: transaction?.seller_id ?? null,
      subject: "Hazi.ng delivery update",
      body: deliveryMessage,
      relatedEntityType: "delivery_order",
      relatedEntityId: deliveryId
    })
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/deliveries");
  revalidatePath(`/transactions/${delivery.transaction_id}`);
}

export async function cancelDeliveryOrder(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const transactionId = getString(formData, "transaction_id");
  const deliveryId = getString(formData, "delivery_id");

  if (!user) {
    redirect(`/auth?next=/transactions/${transactionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  const { data: delivery, error: readError } = await supabase
    .from("delivery_orders")
    .select("id,transaction_id,status,transactions(id,buyer_id,seller_id)")
    .eq("id", deliveryId)
    .eq("transaction_id", transactionId)
    .single();

  if (readError || !delivery) {
    throw new Error(readError?.message ?? "Delivery order not found.");
  }

  const transaction = Array.isArray(delivery.transactions) ? delivery.transactions[0] : delivery.transactions;

  if (![transaction?.buyer_id, transaction?.seller_id].includes(user.id)) {
    throw new Error("Only transaction parties can cancel delivery.");
  }

  if (["delivered", "cancelled"].includes(delivery.status)) {
    throw new Error("This delivery can no longer be cancelled.");
  }

  const { error } = await supabase
    .from("delivery_orders")
    .update({
      status: "cancelled",
      cancellation_reason: getString(formData, "cancellation_reason") || "Cancelled by transaction party.",
      cancelled_at: new Date().toISOString()
    })
    .eq("id", deliveryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/admin/deliveries");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/profile");
  }

  await assertActiveAccount(supabase, user.id);

  const next = safeNextPath(getString(formData, "next") || "/dashboard/profile?saved=1");
  const role = getString(formData, "role");
  const safeRole = SELF_SELECTABLE_PROFILE_ROLES.has(role) ? role : "buyer";
  const coordinates = getOptionalNigeriaCoordinates(formData);
  const profileValues: Record<string, string | number | null> = {
    full_name: getString(formData, "full_name") || user.email?.split("@")[0] || "Hazi user",
    company_name: getString(formData, "company_name") || null,
    phone: getString(formData, "phone") || null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    avatar_url: getString(formData, "avatar_url") || null,
    role: safeRole
  };

  if (formData.has("location")) {
    profileValues.location = getString(formData, "location") || null;
  }

  await upsertProfilePreservingAdmin(supabase, user.id, profileValues);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/auctions");
  revalidatePath("/", "layout");
  redirect(next);
}

export async function updatePayoutSettings(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/payout-settings");
  }

  await assertActiveAccount(supabase, user.id);

  const bankName = getString(formData, "payout_bank_name");
  const accountNumber = getString(formData, "payout_account_number");
  const accountName = getString(formData, "payout_account_name");
  const bankCode = getString(formData, "payout_bank_code") || null;

  if (!bankName || !accountNumber || !accountName) {
    redirect("/dashboard/payout-settings?error=missing");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      payout_bank_name: bankName,
      payout_account_number: accountNumber,
      payout_account_name: accountName,
      payout_bank_code: bankCode,
      payout_verified_at: new Date().toISOString(),
      payout_provider_reference: `manual-${crypto.randomUUID()}`
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/payout-settings");
  redirect("/dashboard/payout-settings?saved=1");
}

export async function updateNotificationPreferences(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/notifications");
  }

  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: user.id,
    sms_enabled: formData.get("sms_enabled") === "on",
    email_enabled: formData.get("email_enabled") === "on",
    push_enabled: formData.get("push_enabled") === "on",
    escrow_updates: formData.get("escrow_updates") === "on",
    bid_updates: formData.get("bid_updates") === "on",
    delivery_updates: formData.get("delivery_updates") === "on",
    marketing_updates: formData.get("marketing_updates") === "on",
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/notifications");
}

export async function submitSupportTicket(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/support");
  }

  const category = getString(formData, "category");
  const subject = getString(formData, "subject");
  const description = getString(formData, "description");
  const returnTo = safeNextPath(getString(formData, "return_to") || "/support");

  if (!category || !subject || !description) {
    redirect(`${returnTo}?error=missing`);
  }

  if (category !== "appeal") {
    await assertActiveAccount(supabase, user.id);
  }

  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    category,
    subject,
    description,
    priority: category === "appeal" ? "urgent" : category === "agent_application" || category === "escrow" || category === "safety" ? "high" : "normal",
    escalation_level: category === "appeal" || category === "agent_application" ? 1 : 0,
    escalation_reason: category === "appeal"
      ? "Suspension appeal requires admin review."
      : category === "agent_application"
        ? "Agent application requires admin review."
        : null,
    escalated_at: category === "appeal" || category === "agent_application" ? new Date().toISOString() : null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");
  redirect(`${returnTo}?ticket=created`);
}

export async function updateSupportTicket(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/support");

  const ticketId = getString(formData, "ticket_id");
  const status = getString(formData, "status");
  const escalationLevel = Math.max(0, Number(formData.get("escalation_level") ?? 0));
  const appealDecision = getString(formData, "appeal_decision") || null;
  const allowedAppealDecisions = new Set(["approved", "denied", "needs_more_information"]);

  if (appealDecision && !allowedAppealDecisions.has(appealDecision)) {
    throw new Error("Unsupported appeal decision.");
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id,user_id,category,subject,status")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({
      status,
      priority: getString(formData, "priority") || "normal",
      admin_notes: getString(formData, "admin_notes") || null,
      assigned_to: getString(formData, "assigned_to") || null,
      escalation_level: escalationLevel,
      escalation_reason: getString(formData, "escalation_reason") || null,
      escalated_at: status === "escalated" || escalationLevel > 0 ? new Date().toISOString() : null,
      appeal_decision: appealDecision,
      appeal_decided_at: appealDecision ? new Date().toISOString() : null,
      resolved_at: ["resolved", "closed"].includes(status) ? new Date().toISOString() : null
    })
    .eq("id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  if (ticket.category === "appeal" && appealDecision === "approved") {
    await supabase
      .from("profiles")
      .update({
        account_status: "active",
        suspension_reason: null,
        suspended_at: null,
        suspended_by: null
      })
      .eq("id", ticket.user_id);
  }

  if (ticket.category === "appeal" && appealDecision) {
    const decisionLabel = appealDecision.replaceAll("_", " ");

    await supabase.from("notifications").insert({
      user_id: ticket.user_id,
      title: "Suspension appeal updated",
      body: appealDecision === "approved"
        ? "Your appeal was approved and your Hazi.ng account has been reactivated."
        : `Your appeal status is now: ${decisionLabel}. Check the support note for details.`,
      type: "support_appeal"
    });

    await recordAuditLog(supabase, {
      actorId: user.id,
      action: `support_appeal_${appealDecision}`,
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        target_user_id: ticket.user_id,
        subject: ticket.subject
      }
    });

    await queueExternalNotification(supabase, {
      actorId: user.id,
      recipientUserId: ticket.user_id,
      subject: "Hazi.ng appeal update",
      body: appealDecision === "approved"
        ? "Your Hazi.ng suspension appeal was approved and your account has been reactivated."
        : `Your Hazi.ng suspension appeal status is now: ${decisionLabel}. Log in to view the support note.`,
      relatedEntityType: "support_ticket",
      relatedEntityId: ticket.id
    });
  }

  if (!(ticket.category === "appeal" && appealDecision)) {
    const statusLabel = status.replaceAll("_", " ");
    const note = getString(formData, "admin_notes");

    await supabase.from("notifications").insert({
      user_id: ticket.user_id,
      title: "Support ticket updated",
      body: note || `Your support ticket "${ticket.subject}" is now ${statusLabel}.`,
      type: "support_ticket"
    });

    await queueExternalNotification(supabase, {
      actorId: user.id,
      recipientUserId: ticket.user_id,
      subject: "Hazi.ng support update",
      body: note || `Your support ticket "${ticket.subject}" is now ${statusLabel}.`,
      relatedEntityType: "support_ticket",
      relatedEntityId: ticket.id
    });
  }

  revalidatePath("/admin/support");
  revalidatePath("/support");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/admin/audit");
}

export async function submitAgentLead(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/agent/request");
  }

  await assertActiveAccount(supabase, user.id);

  const fullName = getString(formData, "full_name") || user.email?.split("@")[0] || "Hazi customer";
  const phone = getString(formData, "phone");
  const location = getString(formData, "location") || "Lagos";
  const itemSummary = getString(formData, "item_summary");
  const preferredSchedule = getString(formData, "preferred_schedule") || null;
  const budget = getString(formData, "budget") || null;
  const preferredAgentId = getString(formData, "preferred_agent_id") || null;

  if (!phone || !itemSummary) {
    throw new Error("Phone number and item details are required.");
  }

  let assignedAgentId: string | null = null;

  if (preferredAgentId) {
    if (!isUuid(preferredAgentId)) {
      throw new Error("Choose a valid agent or Any agent.");
    }

    const { data: selectedAgent } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", preferredAgentId)
      .eq("role", "agent")
      .maybeSingle();

    if (!selectedAgent) {
      throw new Error("That Hazi.ng agent is not available.");
    }

    assignedAgentId = selectedAgent.id;
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, location })
      .eq("id", user.id);
  } else {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      phone,
      location,
      role: "buyer"
    });
  }

  const { data: lead, error } = await supabase.from("agent_leads").insert({
    requester_id: user.id,
    full_name: fullName,
    phone,
    location,
    item_summary: itemSummary,
    preferred_schedule: preferredSchedule,
    budget,
    assigned_agent_id: assignedAgentId,
    status: assignedAgentId ? "assigned" : "new"
  }).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  if (assignedAgentId && lead) {
    const { error: jobError } = await supabase.rpc("create_agent_job_for_assigned_lead", {
      p_lead_id: lead.id
    });

    if (jobError) {
      throw new Error(jobError.message);
    }
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/admin/agent-leads");
  revalidatePath("/dashboard/agent");
}

export async function updateAgentLeadStatus(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/agent-leads");

  const leadId = getString(formData, "lead_id");
  const status = getString(formData, "status");
  const allowedStatuses = new Set(["new", "contacted", "assigned", "closed"]);

  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported agent lead status.");
  }

  const { error } = status === "assigned"
    ? await supabase.rpc("claim_agent_lead_as_job", { p_lead_id: leadId })
    : await supabase
        .from("agent_leads")
        .update({ status })
        .eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `agent_lead_${status}`,
    entityType: "agent_lead",
    entityId: leadId,
    metadata: { status }
  });

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/agent-leads");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
}

export async function claimAgentLead(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/agent");
  }

  await assertActiveAccount(supabase, user.id);

  await requireAgentDashboardAction(supabase, user.id, "Only agents can claim agent leads.");

  const leadId = getString(formData, "lead_id");

  const { error } = await supabase.rpc("claim_agent_lead_as_job", {
    p_lead_id: leadId
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/admin/agent-leads");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
}

export async function updateAssignedAgentLeadStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/agent");
  }

  await assertActiveAccount(supabase, user.id);

  await requireAgentDashboardAction(supabase, user.id, "Only agents can update agent leads.");

  const leadId = getString(formData, "lead_id");
  const status = getString(formData, "status");
  const allowedStatuses = new Set(["contacted", "assigned", "closed"]);

  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported agent lead status.");
  }

  const { error } = await supabase
    .from("agent_leads")
    .update({ status })
    .eq("id", leadId)
    .eq("assigned_agent_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/admin/agent-leads");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
}

export async function updateAgentJobStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/agent");
  }

  await assertActiveAccount(supabase, user.id);

  await requireAgentDashboardAction(supabase, user.id, "Only agents can update agent jobs.");

  const jobId = getString(formData, "job_id");
  const status = getString(formData, "status");
  const commission = Number(formData.get("commission_amount") ?? 0);
  const notes = getString(formData, "notes");

  const { error } = await supabase.rpc("update_agent_job_status", {
    p_job_id: jobId,
    p_status: status,
    p_commission: Number.isFinite(commission) ? commission : null,
    p_notes: notes || null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/agent");
  revalidatePath("/admin/agent-leads");
  revalidatePath("/admin/finance");
}

export async function boostAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const plan = getString(formData, "plan") || "listing_boost_7d";
  const { data: premiumSubscription } = await supabase
    .from("premium_subscriptions")
    .select("id,plan")
    .eq("user_id", user.id)
    .is("auction_id", null)
    .in("plan", ["premium_seller", "premium_business", "premium_agent"])
    .eq("status", "active")
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();

  if (!premiumSubscription) {
    const { data: referralReward } = await supabase
      .from("referral_boost_rewards")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "unused")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (referralReward) {
      const { error: boostError } = await supabase.rpc("boost_auction", {
        p_auction_id: auctionId,
        p_plan: plan
      });

      if (boostError) {
        redirect("/dashboard/listings?boost=failed");
      }

      await supabase
        .from("referral_boost_rewards")
        .update({
          status: "used",
          used_auction_id: auctionId,
          used_at: new Date().toISOString()
        })
        .eq("id", referralReward.id)
        .eq("user_id", user.id);

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/listings");
      revalidatePath("/auctions");
      revalidatePath(`/auctions/${auctionId}`);
      redirect("/dashboard/listings?boost=referral");
    }

    redirect(`/premium?auction_id=${auctionId}&boost_plan=${plan}`);
  }

  const boostLimit = PREMIUM_BOOST_LIMITS[premiumSubscription.plan] ?? 0;

  if (boostLimit !== null) {
    const { count: activeBoosts } = await supabase
      .from("auctions")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("is_premium", true)
      .in("status", ["active", "paused"]);

    const { data: currentAuction } = await supabase
      .from("auctions")
      .select("id,is_premium")
      .eq("id", auctionId)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (!currentAuction) {
      redirect("/dashboard/listings?boost=failed");
    }

    if (!currentAuction.is_premium && Number(activeBoosts ?? 0) >= boostLimit) {
      redirect(`/dashboard/listings?boost=limit-${boostLimit}`);
    }
  }

  const { error } = await supabase.rpc("boost_auction", {
    p_auction_id: auctionId,
    p_plan: plan
  });

  if (error) {
    redirect("/dashboard/listings?boost=failed");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/listings?boost=active");
}

export async function updateAuctionStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const nextStatus = getString(formData, "status");
  const allowedStatuses = new Set(["active", "paused", "closed"]);

  if (!allowedStatuses.has(nextStatus)) {
    throw new Error("Unsupported auction status.");
  }

  const { data: auction, error: readError } = await supabase
    .from("auctions")
    .select("id,status,seller_id")
    .eq("id", auctionId)
    .eq("seller_id", user.id)
    .single();

  if (readError || !auction) {
    throw new Error(readError?.message ?? "Auction not found.");
  }

  if (!["active", "paused"].includes(auction.status) || (auction.status === "active" && nextStatus === "active")) {
    throw new Error("This auction cannot be changed to that status.");
  }

  const { error } = await supabase
    .from("auctions")
    .update({ status: nextStatus })
    .eq("id", auctionId)
    .eq("seller_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
}

export async function relistAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const durationHours = Math.max(1, Math.min(720, Number(formData.get("duration_hours") ?? 72)));

  const { data: auction, error: readError } = await supabase
    .from("auctions")
    .select("id,status,seller_id,seller_price")
    .eq("id", auctionId)
    .eq("seller_id", user.id)
    .single();

  if (readError || !auction) {
    throw new Error(readError?.message ?? "Auction not found.");
  }

  if (!["expired", "closed", "paused"].includes(auction.status)) {
    throw new Error("Only expired, closed, or paused auctions can be relisted.");
  }

  const { error } = await supabase
    .from("auctions")
    .update({
      status: "active",
      accepted_bid_id: null,
      current_bid: Math.round(Number(auction.seller_price ?? 0) * 0.5),
      ends_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", auctionId)
    .eq("seller_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("bids")
    .update({ status: "rejected" })
    .eq("auction_id", auctionId)
    .eq("status", "pending");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
}

export async function adminUpdateAuctionStatus(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin");
  const auctionId = getString(formData, "auction_id");
  const nextStatus = getString(formData, "status");
  const allowedStatuses = new Set(["active", "paused", "closed"]);

  if (!allowedStatuses.has(nextStatus)) {
    throw new Error("Unsupported auction status.");
  }

  const { error } = await supabase
    .from("auctions")
    .update({ status: nextStatus })
    .eq("id", auctionId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `admin_auction_${nextStatus}`,
    entityType: "auction",
    entityId: auctionId,
    metadata: { status: nextStatus }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/auctions");
  revalidatePath("/admin/audit");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
}

export async function adminDeleteAuction(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin");
  const auctionId = getString(formData, "auction_id");

  const { error } = await supabase
    .from("auctions")
    .delete()
    .eq("id", auctionId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "admin_auction_deleted",
    entityType: "auction",
    entityId: auctionId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/auctions");
  revalidatePath("/admin/audit");
  revalidatePath("/auctions");
}

export async function updateAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  await assertActiveAccount(supabase, user.id);

  const auctionId = getString(formData, "auction_id");
  const sellerPrice = Number(formData.get("seller_price") ?? 0);
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const coordinates = getOptionalNigeriaCoordinates(formData);

  if (coordinates.latitude === null || coordinates.longitude === null) {
    redirect(`/dashboard/listings/${auctionId}/edit?error=pickup-location`);
  }

  if (!title || !description || sellerPrice < 1) {
    throw new Error("Title, description, and seller price are required.");
  }

  const { data: auction, error: readError } = await supabase
    .from("auctions")
    .select("id,status,seller_id")
    .eq("id", auctionId)
    .eq("seller_id", user.id)
    .single();

  if (readError || !auction) {
    throw new Error(readError?.message ?? "Auction not found.");
  }

  if (!["draft", "active", "paused"].includes(auction.status)) {
    throw new Error("Accepted or closed auctions cannot be edited.");
  }

  const { error } = await supabase
    .from("auctions")
    .update({
      category_id: getString(formData, "category_id") || null,
      title,
      description,
      condition: getString(formData, "condition") || "good",
      location: getString(formData, "location") || "Lagos",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      seller_price: sellerPrice,
      reserve_price: null,
      pickup_available: formData.get("pickup_available") === "on",
      delivery_available: formData.get("delivery_available") === "on"
    })
    .eq("id", auctionId)
    .eq("seller_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${auctionId}`);
  redirect(`/auctions/${auctionId}`);
}

export async function saveAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const auctionId = getString(formData, "auction_id");

  if (!user) {
    redirect(`/auth?next=/auctions/${auctionId}`);
  }

  await assertActiveAccount(supabase, user.id);

  await upsertProfilePreservingAdmin(supabase, user.id, {
    full_name: user.email?.split("@")[0] ?? "Hazi Buyer",
    role: "buyer"
  });

  const { error } = await supabase.from("auction_watchlist").upsert({
    user_id: user.id,
    auction_id: auctionId
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/watchlist");
}

export async function removeSavedAuction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const auctionId = getString(formData, "auction_id");

  if (!user) {
    redirect(`/auth?next=/auctions/${auctionId}`);
  }

  const { error } = await supabase
    .from("auction_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("auction_id", auctionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/watchlist");
}

export async function markNotificationRead(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/notifications");
  }

  const notificationId = getString(formData, "notification_id");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function markAllNotificationsRead() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/notifications");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function submitVerification(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase env vars are missing.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/verification");
  }

  await assertActiveAccount(supabase, user.id);

  const documentType = getString(formData, "document_type") || "government_id";
  const notes = getString(formData, "notes");
  const fullName = getString(formData, "full_name") || user.email?.split("@")[0] || "Hazi User";
  const documentFile = formData.get("document_file");
  const livenessFile = formData.get("liveness_file");

  if (!isUsableFile(documentFile)) {
    throw new Error("Upload a JPEG, PNG, WebP, or PDF document for verification.");
  }

  if (!isUsableFile(livenessFile)) {
    throw new Error("Upload a live selfie for liveness and face match review.");
  }

  if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.has(documentFile.type)) {
    throw new Error("Verification documents must be JPEG, PNG, WebP, or PDF files.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(livenessFile.type)) {
    throw new Error("Liveness selfie must be JPEG, PNG, or WebP.");
  }

  if (documentFile.size > MAX_VERIFICATION_DOCUMENT_BYTES) {
    throw new Error("Verification documents must be 10MB or smaller.");
  }

  if (livenessFile.size > MAX_VERIFICATION_DOCUMENT_BYTES) {
    throw new Error("Liveness selfie must be 10MB or smaller.");
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName
  });

  const filePath = `${user.id}/${crypto.randomUUID()}-${slugFileName(documentFile.name)}`;
  const livenessPath = `${user.id}/${crypto.randomUUID()}-liveness-${slugFileName(livenessFile.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(VERIFICATION_DOCUMENT_BUCKET)
    .upload(filePath, documentFile, {
      cacheControl: "3600",
      contentType: documentFile.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: livenessUploadError } = await supabase.storage
    .from(VERIFICATION_DOCUMENT_BUCKET)
    .upload(livenessPath, livenessFile, {
      cacheControl: "3600",
      contentType: livenessFile.type,
      upsert: false
    });

  if (livenessUploadError) {
    throw new Error(livenessUploadError.message);
  }

  const { error } = await supabase.from("verification_records").insert({
    user_id: user.id,
    document_type: documentType,
    status: "pending",
    notes,
    document_url: filePath,
    document_name: documentFile.name,
    liveness_url: livenessPath,
    liveness_name: livenessFile.name,
    liveness_required: true,
    liveness_status: "pending",
    face_match_status: "pending"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/verification");
  redirect("/dashboard/verification?submitted=1");
}

export async function reviewVerification(formData: FormData) {
  const { supabase, user } = await requireAdminAction("/admin/kyc");

  const recordId = getString(formData, "record_id");
  const decision = getString(formData, "decision");
  const notes = getString(formData, "notes");
  const livenessStatus = getString(formData, "liveness_status") || null;
  const faceMatchStatus = getString(formData, "face_match_status") || null;
  const provider = getString(formData, "provider") || "admin_review";
  const providerReference = getString(formData, "provider_reference") || null;
  const providerScoreValue = getString(formData, "provider_score");
  const providerScore = providerScoreValue ? Number(providerScoreValue) : null;

  const { data: record } = await supabase
    .from("verification_records")
    .select("user_id")
    .eq("id", recordId)
    .single();

  const { error } = await supabase.rpc("review_verification_record", {
    p_record_id: recordId,
    p_decision: decision,
    p_notes: notes,
    p_liveness_status: livenessStatus,
    p_face_match_status: faceMatchStatus,
    p_provider: provider,
    p_provider_reference: providerReference,
    p_provider_score: Number.isFinite(providerScore) ? providerScore : null,
    p_provider_payload: {
      source: "admin_review_form"
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: `verification_${decision}`,
    entityType: "verification_record",
    entityId: recordId,
    metadata: { decision, notes, provider, provider_reference: providerReference, provider_score: Number.isFinite(providerScore) ? providerScore : null }
  });

  await queueExternalNotification(supabase, {
    actorId: user.id,
    recipientUserId: record?.user_id ?? null,
    subject: decision === "approved" ? "Hazi.ng verification approved" : "Hazi.ng verification rejected",
    body: decision === "approved"
      ? "Your Hazi.ng identity verification has been approved."
      : notes || "Your Hazi.ng verification was rejected. Please resubmit clearer documents.",
    relatedEntityType: "verification_record",
    relatedEntityId: recordId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/notifications");
}

export async function resolveAppErrorEvent(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/admin/errors");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  const errorId = getString(formData, "error_id");

  if (!errorId) {
    throw new Error("Error event is missing.");
  }

  const { error } = await supabase
    .from("app_error_events")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id
    })
    .eq("id", errorId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditLog(supabase, {
    actorId: user.id,
    action: "app_error_resolved",
    entityType: "app_error_event",
    entityId: errorId
  });

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/errors");
}
