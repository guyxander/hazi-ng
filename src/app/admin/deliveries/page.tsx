import Link from "next/link";
import { PackageCheck, Truck } from "lucide-react";
import { updateDeliveryOrder } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminDeliveriesPage() {
  const supabase = await requireAdmin("/admin/deliveries");

  if (!supabase) {
    return null;
  }

  const { data: deliveries } = await supabase
    .from("delivery_orders")
    .select("id,transaction_id,provider,pickup_location,dropoff_location,distance_km,fee,status,tracking_code,courier_name,courier_phone,notes,exception_reason,cancellation_reason,provider_tracking_url,created_at,transactions(id,status,auctions(id,title,location))")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium"><Truck size={14} /> Logistics operations</span>
          <h1 className="section-title mt-4">Delivery queue</h1>
          <p className="mt-2 text-[var(--muted)]">Assign couriers, update pickup and transit state, and track delivery completion.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {deliveries?.length ? deliveries.map((delivery) => {
            const transaction = Array.isArray(delivery.transactions) ? delivery.transactions[0] : delivery.transactions;
            const auction = Array.isArray(transaction?.auctions) ? transaction?.auctions[0] : transaction?.auctions;

            return (
              <article key={delivery.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_240px_330px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/transactions/${delivery.transaction_id}`} className="text-lg font-extrabold text-[var(--primary)] hover:underline">
                      {auction?.title ?? "Delivery order"}
                    </Link>
                    <span className="badge badge-live capitalize">{delivery.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">{delivery.tracking_code}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{delivery.pickup_location} to {delivery.dropoff_location}</p>
                  {delivery.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{delivery.notes}</p> : null}
                  {delivery.exception_reason ? <p className="mt-2 text-sm font-bold text-red-700">{delivery.exception_reason}</p> : null}
                  {delivery.cancellation_reason ? <p className="mt-2 text-sm font-bold text-red-700">{delivery.cancellation_reason}</p> : null}
                  {delivery.provider_tracking_url ? <a href={delivery.provider_tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline">Provider tracking</a> : null}
                </div>

                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><PackageCheck size={16} /> {delivery.provider}</p>
                  <p><span className="font-bold text-[var(--muted)]">Fee:</span> {formatNaira(Number(delivery.fee ?? 0))}</p>
                  <p><span className="font-bold text-[var(--muted)]">Distance:</span> {delivery.distance_km ?? "?"} km</p>
                  <p><span className="font-bold text-[var(--muted)]">Courier:</span> {delivery.courier_name || "Unassigned"}</p>
                  <p><span className="font-bold text-[var(--muted)]">Phone:</span> {delivery.courier_phone || "Not set"}</p>
                </div>

                <form action={updateDeliveryOrder} className="space-y-2">
                  <input type="hidden" name="delivery_id" value={delivery.id} />
                  <select className="select" name="status" defaultValue={delivery.status}>
                    <option value="booked">Booked</option>
                    <option value="assigned">Assigned</option>
                    <option value="picked_up">Picked up</option>
                    <option value="in_transit">In transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="exception">Exception</option>
                  </select>
                  <input className="input" name="courier_name" defaultValue={delivery.courier_name ?? ""} placeholder="Courier name" />
                  <input className="input" name="courier_phone" defaultValue={delivery.courier_phone ?? ""} placeholder="Courier phone" />
                  <textarea className="textarea min-h-[82px]" name="notes" defaultValue={delivery.notes ?? ""} placeholder="Dispatch notes" />
                  <input className="input" name="exception_reason" defaultValue={delivery.exception_reason ?? ""} placeholder="Exception reason" />
                  <input className="input" name="cancellation_reason" defaultValue={delivery.cancellation_reason ?? ""} placeholder="Cancellation reason" />
                  <button className="button button-primary w-full" type="submit">Update delivery</button>
                </form>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No delivery orders booked yet.</p>}
        </div>
      </section>
    </main>
  );
}
