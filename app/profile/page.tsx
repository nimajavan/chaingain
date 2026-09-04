// Connected-wallet profile with aggregate statistics and on-chain ticket stubs.
"use client";

import { Copy, Ticket, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLotto } from "../components/client-shell";
import { formatUsdt, loadApi, shortAddress } from "../data";

type ProfileData = { purchases: { draw_id: number; quantity: number; amount_atomic: string; transaction_id: string }[];
  claims: { kind: string; draw_id: number; amount_atomic: string; transaction_id: string }[] };

export default function ProfilePage() {
  const { account, connect, openBuy } = useLotto();
  const [profile, setProfile] = useState<ProfileData>({ purchases: [], claims: [] });
  useEffect(() => { if (account) void loadApi<ProfileData>(`/api/profile/${account}`).then((data) => setProfile(data ?? { purchases: [], claims: [] })); }, [account]);
  const summary = useMemo(() => ({
    tickets: profile.purchases.reduce((total, item) => total + item.quantity, 0),
    spent: profile.purchases.reduce((total, item) => total + BigInt(item.amount_atomic), 0n),
    payouts: profile.claims.filter((item) => item.kind === "payout"),
    earned: profile.claims.filter((item) => item.kind === "payout").reduce((total, item) => total + BigInt(item.amount_atomic), 0n),
  }), [profile]);

  if (!account) {
    return (
      <main className="mx-auto flex min-h-[66vh] max-w-3xl items-center px-4 py-16 sm:px-6">
        <section className="glass w-full rounded-[26px] p-7 text-center sm:p-12">
          <div className="primary-gradient primary-glow mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"><Wallet className="h-8 w-8 text-white" /></div>
          <h1 className="display-font mt-6 text-3xl font-bold text-white">Your tickets live with your wallet</h1>
          <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-zinc-500">Connect to see active ticket numbers, lifetime entries, wins, and verified payouts. No email or password required.</p>
          <Button onClick={connect} className="primary-gradient primary-glow mt-7 h-12 rounded-xl px-7 text-base font-semibold"><Wallet className="h-5 w-5" /> Connect wallet</Button>
        </section>
      </main>
    );
  }

  const hue = account.split("").reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
  const copyAddress = async () => {
    await navigator.clipboard.writeText(account);
    toast.success("Wallet address copied");
  };

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <section className="glass relative overflow-hidden rounded-[26px] p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl border border-white/15 shadow-xl" style={{ background: `linear-gradient(135deg,hsl(${hue} 72% 56%),hsl(${(hue + 78) % 360} 82% 45%))` }} />
            <div>
              <p className="text-sm font-medium text-violet-300">Connected through TronLink</p>
              <div className="mt-1 flex items-center gap-2"><h1 className="mono text-lg font-semibold text-white sm:text-xl">{shortAddress(account)}</h1><button onClick={copyAddress} className="focus-ring rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[.05] hover:text-white" aria-label="Copy wallet address"><Copy className="h-4 w-4" /></button></div>
            </div>
          </div>
          <Button onClick={openBuy} className="primary-gradient primary-glow h-11 rounded-xl px-5 font-semibold"><Ticket className="h-4 w-4" /> Buy more tickets</Button>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProfileStat label="Lifetime tickets" value={String(summary.tickets)} note={`${new Set(profile.purchases.map((item) => item.draw_id)).size} indexed draws`} />
        <ProfileStat label="Total spent" value={`${formatUsdt(summary.spent)} USDT`} note="Confirmed purchases only" />
        <ProfileStat label="Payout claims" value={String(summary.payouts.length)} note="Confirmed claims" highlight />
        <ProfileStat label="Claimed" value={`${formatUsdt(summary.earned, true)}`} note="Paid on TRON" highlight />
      </section>

      <section className="mt-12" aria-labelledby="tickets-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Confirmed history</p><h2 id="tickets-heading" className="display-font mt-2 text-3xl font-bold text-white">Your indexed entries</h2></div>
          <p className="text-sm text-zinc-500">Derived from finalized TRON events</p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {profile.purchases.slice(0, 9).map((item) => <article key={item.transaction_id} className="glass rounded-[20px] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Draw #{item.draw_id}</p><p className="display-font mt-3 text-2xl font-semibold text-white">{item.quantity} ticket{item.quantity === 1 ? "" : "s"}</p><p className="mono mt-2 truncate text-xs text-zinc-600">{item.transaction_id}</p></article>)}
          {!profile.purchases.length && <p className="col-span-full rounded-[20px] border border-white/[.07] p-10 text-center text-zinc-600">No confirmed purchases indexed for this wallet.</p>}
        </div>
      </section>
    </main>
  );
}

function ProfileStat({ label, value, note, highlight = false }: { label: string; value: string; note: string; highlight?: boolean }) {
  return <article className="glass rounded-[18px] p-4 sm:p-5"><p className="text-sm text-zinc-500">{label}</p><p className={`display-font mt-2 text-xl font-semibold sm:text-2xl ${highlight ? "gold-text" : "text-white"}`}>{value}</p><p className="mt-2 text-xs text-zinc-600">{note}</p></article>;
}
