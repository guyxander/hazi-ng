alter table public.auctions
  add column if not exists agent_job_id uuid references public.agent_jobs(id) on delete set null;

alter table public.transactions
  add column if not exists agent_job_id uuid references public.agent_jobs(id) on delete set null;

create index if not exists auctions_agent_job_id_idx on public.auctions(agent_job_id);
create index if not exists transactions_agent_job_id_idx on public.transactions(agent_job_id);

create or replace function public.release_transaction_escrow_to_seller(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
  v_agent_job public.agent_jobs%rowtype;
  v_reference text;
  v_seller_amount numeric;
  v_agent_amount numeric;
  v_platform_amount numeric;
begin
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if exists (
    select 1 from public.wallet_ledger_entries
    where entry_type = 'seller_earning_credit'
      and related_entity_type = 'transaction'
      and related_entity_id = p_transaction_id
  ) then
    return;
  end if;

  perform public.ensure_transaction_escrow_hold(p_transaction_id, 'legacy', 'legacy-escrow-' || p_transaction_id::text);

  v_reference := 'escrow-release-' || p_transaction_id::text;

  perform public.adjust_wallet_bucket(
    v_transaction.buyer_id,
    'escrow',
    'debit',
    v_transaction.amount,
    'escrow_release_debit',
    'Escrow released',
    'wallet',
    v_reference || '-buyer',
    'transaction',
    p_transaction_id,
    jsonb_build_object('agent_assisted', v_transaction.agent_job_id is not null)
  );

  if v_transaction.agent_job_id is null then
    perform public.adjust_wallet_bucket(
      v_transaction.seller_id,
      'earnings',
      'credit',
      v_transaction.amount,
      'seller_earning_credit',
      'Seller earning from completed transaction',
      'wallet',
      v_reference || '-seller',
      'transaction',
      p_transaction_id,
      '{}'::jsonb
    );
    return;
  end if;

  select * into v_agent_job
  from public.agent_jobs
  where id = v_transaction.agent_job_id
  for update;

  if not found then
    raise exception 'Linked agent job not found';
  end if;

  if v_agent_job.requester_id is null or v_agent_job.agent_id is null then
    raise exception 'Linked agent job is missing requester or agent';
  end if;

  v_agent_amount := round(v_transaction.amount * 0.21, 2);
  v_platform_amount := round(v_transaction.amount * 0.09, 2);
  v_seller_amount := v_transaction.amount - v_agent_amount - v_platform_amount;

  perform public.adjust_wallet_bucket(
    v_agent_job.requester_id,
    'earnings',
    'credit',
    v_seller_amount,
    'seller_earning_credit',
    'Agent-assisted sale earning: 70% seller share',
    'wallet',
    v_reference || '-seller-70',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'agent_assisted', true,
      'agent_job_id', v_agent_job.id,
      'agent_id', v_agent_job.agent_id,
      'seller_share_percent', 70
    )
  );

  perform public.adjust_wallet_bucket(
    v_agent_job.agent_id,
    'earnings',
    'credit',
    v_agent_amount,
    'agent_commission_credit',
    'Agent-assisted sale commission: 21% agent share',
    'wallet',
    v_reference || '-agent-21',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'agent_assisted', true,
      'agent_job_id', v_agent_job.id,
      'requester_id', v_agent_job.requester_id,
      'agent_share_percent', 21
    )
  );

  update public.agent_jobs
  set commission_amount = v_agent_amount,
      commission_status = 'earned',
      status = case when status = 'cancelled' then status else 'completed' end,
      updated_at = now()
  where id = v_agent_job.id;

  insert into public.finance_settlements (
    settlement_type,
    provider,
    provider_reference,
    gross_amount,
    fee_amount,
    net_amount,
    status,
    related_entity_type,
    related_entity_id,
    metadata
  )
  values (
    'agent_assisted_sale_platform_fee',
    'wallet',
    v_reference || '-hazi-9',
    v_transaction.amount,
    v_platform_amount,
    v_platform_amount,
    'recorded',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'agent_assisted', true,
      'agent_job_id', v_agent_job.id,
      'platform_share_percent', 9,
      'seller_share', v_seller_amount,
      'agent_share', v_agent_amount
    )
  )
  on conflict do nothing;

  insert into public.notifications (user_id, title, body, type)
  values
    (v_agent_job.requester_id, 'Agent-assisted sale paid', 'Your 70% seller share has been credited to your Hazi.ng earnings wallet.', 'agent_sale_payout'),
    (v_agent_job.agent_id, 'Agent commission earned', 'Your 21% agent commission has been credited to your Hazi.ng earnings wallet.', 'agent_commission');
end;
$$;

create or replace function public.resolve_bid(p_bid_id uuid, p_decision text)
returns table(auction_id uuid, bid_id uuid, decision text)
language plpgsql
security definer
set search_path = public
as $$
declare
  bid_record public.bids%rowtype;
  auction_record public.auctions%rowtype;
  normalized_decision text;
  v_transaction_id uuid;
begin
  normalized_decision := lower(trim(p_decision));

  if normalized_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;

  select * into bid_record
  from public.bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Bid not found';
  end if;

  select * into auction_record
  from public.auctions
  where id = bid_record.auction_id
  for update;

  if not found then
    raise exception 'Auction not found';
  end if;

  if auction_record.seller_id <> (select auth.uid()) then
    raise exception 'Only the auction seller can resolve bids';
  end if;

  if auction_record.status <> 'active' then
    raise exception 'Only active auctions can resolve bids';
  end if;

  if bid_record.status <> 'pending' then
    raise exception 'Only pending bids can be resolved';
  end if;

  update public.bids
  set status = normalized_decision
  where id = p_bid_id;

  if normalized_decision = 'accepted' then
    update public.bids
    set status = 'rejected'
    where auction_id = bid_record.auction_id
      and id <> p_bid_id
      and status = 'pending';

    update public.auctions
    set status = 'accepted',
        accepted_bid_id = p_bid_id,
        current_bid = bid_record.amount,
        updated_at = now()
    where id = auction_record.id;

    insert into public.transactions (auction_id, buyer_id, seller_id, bid_id, amount, status, agent_job_id)
    values (auction_record.id, bid_record.bidder_id, auction_record.seller_id, bid_record.id, bid_record.amount, 'escrow_pending', auction_record.agent_job_id)
    on conflict (bid_id) where bid_id is not null do update
      set updated_at = now(),
          agent_job_id = coalesce(public.transactions.agent_job_id, excluded.agent_job_id)
    returning id into v_transaction_id;

    insert into public.notifications (user_id, title, body, type)
    values
      (bid_record.bidder_id, 'Bid accepted', auction_record.title || ': your bid was accepted. Please pay into escrow.', 'bid_accepted'),
      (auction_record.seller_id, 'Escrow transaction created', auction_record.title || ': Hazi.ng created the escrow transaction for the accepted bid.', 'transaction_created');
  else
    insert into public.notifications (user_id, title, body, type)
    values (
      bid_record.bidder_id,
      'Your bid was declined',
      'Your bid on ' || auction_record.title || ' was declined. You can place a stronger bid if the auction is still live.',
      'bid_rejected'
    );
  end if;

  return query select bid_record.auction_id, p_bid_id, normalized_decision;
end;
$$;
