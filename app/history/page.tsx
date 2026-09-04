// Searchable, BigInt-safe history of completed LottoChain draws.
"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Search, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { drawHistory, formatUsdt, shortAddress } from "../data";
import { useLotto } from "../components/client-shell";

export default function HistoryPage() {
  const { account } = useLotto();
  const [query, setQuery] = useState("");
  const filteredDraws = useMemo(() => drawHistory.filter((draw) => draw.winner.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const totalPaid = drawHistory.reduce((total, draw) => total + draw.prize, 0n);
  const totalTickets = drawHistory.reduce((total, draw) => total + draw.tickets, 0);

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Immutable results</p>
          <h1 className="display-font mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Draw history</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-zinc-500">Every winning wallet, payout, and randomness proof remains independently verifiable.</p>
        </div>
        <label className="relative block w-full md:max-w-sm">
          <span className="sr-only">Search winner address</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search winner address" className="focus-ring mono h-12 w-full rounded-xl border border-white/[.09] bg-white/[.035] pl-11 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600" />
        </label>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Summary label="Total paid to winners" value={`${formatUsdt(totalPaid, true)} USDT`} />
        <Summary label="Completed draws" value={String(drawHistory.length)} />
        <Summary label="Tickets indexed" value={totalTickets.toLocaleString("en-US")} />
      </section>

      <section className="glass mt-5 overflow-hidden rounded-[22px]" aria-label="Completed draws">
        {filteredDraws.length ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/[.07] hover:bg-transparent">
                <TableHead className="h-14 px-5 text-xs uppercase tracking-wider text-zinc-600">Draw</TableHead>
                <TableHead className="hidden h-14 text-xs uppercase tracking-wider text-zinc-600 sm:table-cell">Date</TableHead>
                <TableHead className="h-14 text-xs uppercase tracking-wider text-zinc-600">Winner</TableHead>
                <TableHead className="h-14 text-xs uppercase tracking-wider text-zinc-600">Prize</TableHead>
                <TableHead className="hidden h-14 text-xs uppercase tracking-wider text-zinc-600 lg:table-cell">Tickets</TableHead>
                <TableHead className="hidden h-14 text-xs uppercase tracking-wider text-zinc-600 md:table-cell">Fairness</TableHead>
                <TableHead className="h-14 pr-5 text-right text-xs uppercase tracking-wider text-zinc-600"><span className="sr-only">View</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDraws.map((draw) => {
                const isYou = account?.toLowerCase() === draw.winner.toLowerCase();
                return (
                  <TableRow key={draw.id} className="border-white/[.06] hover:bg-white/[.025]">
                    <TableCell className="display-font px-5 py-5 font-semibold text-white">#{draw.id}</TableCell>
                    <TableCell className="hidden py-5 text-zinc-500 sm:table-cell">{draw.date}</TableCell>
                    <TableCell className="py-5"><div className="flex items-center gap-2"><span className="mono text-xs text-zinc-300 sm:text-sm">{shortAddress(draw.winner)}</span>{isYou && <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">YOU</span>}</div></TableCell>
                    <TableCell className="display-font py-5 font-semibold text-amber-300">${formatUsdt(draw.prize)}</TableCell>
                    <TableCell className="hidden py-5 text-zinc-500 lg:table-cell">{draw.tickets.toLocaleString("en-US")}</TableCell>
                    <TableCell className="hidden py-5 md:table-cell"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-2.5 py-1 text-xs font-medium text-emerald-300"><Check className="h-3.5 w-3.5" /> VRF verified</span></TableCell>
                    <TableCell className="pr-5 text-right"><Link href={`/draws/${draw.id}`} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[.06] hover:text-white" aria-label={`View Draw ${draw.id}`}><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-20 text-center"><Trophy className="mx-auto h-8 w-8 text-zinc-700" /><h2 className="display-font mt-4 text-lg font-semibold text-zinc-300">No matching winner</h2><p className="mt-2 text-sm text-zinc-600">Try the full wallet address or a shorter fragment.</p></div>
        )}
      </section>
      <p className="mt-4 text-center text-xs text-zinc-600">Sample records remain clearly separated until the TRON Mainnet contract is deployed and indexed.</p>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="glass rounded-[18px] p-5"><p className="text-sm text-zinc-500">{label}</p><p className="display-font mt-2 text-2xl font-semibold text-white">{value}</p></div>;
}
