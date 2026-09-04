// Connected-wallet profile with aggregate statistics and on-chain ticket stubs.
"use client";

import Link from "next/link";
import { Copy, ExternalLink, Sparkles, Ticket, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLotto } from "../components/client-shell";
import { formatUsdt, shortAddress } from "../data";

const ticketNumbers = [1627, 1628, 1629];

export default function ProfilePage() {
  const { account, connect, openBuy } = useLotto();

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
        <ProfileStat label="Lifetime tickets" value="27" note="Across 9 draws" />
        <ProfileStat label="Total spent" value={`${formatUsdt(270_000_000n)} USDT`} note="Exact TRC-20 approvals only" />
        <ProfileStat label="Wins" value="1" note="Draw #1042" highlight />
        <ProfileStat label="Earnings" value={`${formatUsdt(12_348_000_000n, true)}`} note="Paid on TRON" highlight />
      </section>

      <section className="mt-12" aria-labelledby="tickets-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Active draw #1043</p><h2 id="tickets-heading" className="display-font mt-2 text-3xl font-bold text-white">Your ticket stubs</h2></div>
          <p className="text-sm text-zinc-500">3 entries · 1 in 1,262 combined odds</p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {ticketNumbers.map((number) => <TicketStub key={number} number={number} owner={account} />)}
        </div>
      </section>

      <section className="glass mt-10 flex flex-col gap-5 rounded-[20px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><Trophy className="h-5 w-5" /></span><div><h2 className="font-semibold text-white">Sample result · Draw #1042</h2><p className="mt-1 text-sm text-zinc-500">Illustrative payout: $12,348 USDT through the TRON contract flow.</p></div></div>
        <Link href="/draws/1042" className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[.09] bg-white/[.04] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:text-white">View proof <ExternalLink className="h-4 w-4" /></Link>
      </section>
    </main>
  );
}

function ProfileStat({ label, value, note, highlight = false }: { label: string; value: string; note: string; highlight?: boolean }) {
  return <article className="glass rounded-[18px] p-4 sm:p-5"><p className="text-sm text-zinc-500">{label}</p><p className={`display-font mt-2 text-xl font-semibold sm:text-2xl ${highlight ? "gold-text" : "text-white"}`}>{value}</p><p className="mt-2 text-xs text-zinc-600">{note}</p></article>;
}

function TicketStub({ number, owner }: { number: number; owner: string }) {
  return (
    <article className="ticket-cutout glass glass-hover relative overflow-hidden rounded-[20px]">
      <div className="grid min-h-48 grid-cols-[1fr_66px]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-violet-300"><Sparkles className="h-3.5 w-3.5" /> Draw #1043</div>
          <p className="display-font mt-6 text-sm uppercase tracking-widest text-zinc-600">Ticket number</p>
          <p className="display-font gold-text mt-1 text-4xl font-bold">#{number}</p>
          <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-zinc-600">Owner</p><p className="mono mt-1 text-xs text-zinc-400">{shortAddress(owner)}</p></div><div className="barcode h-7 w-20 opacity-40" aria-hidden="true" /></div>
        </div>
        <div className="flex items-center justify-center border-l border-dashed border-white/15 bg-white/[.02]"><span className="display-font rotate-90 whitespace-nowrap text-xs font-bold tracking-[.3em] text-zinc-600">LOTTOCHAIN</span></div>
      </div>
    </article>
  );
}
