// TRON wallet connection, exact-USDT purchase flow, navigation, and shared footer.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Menu,
  Minus,
  Plus,
  ShieldCheck,
  Ticket,
  Wallet,
  X,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsdt, TICKET_PRICE, TRON_USDT_ADDRESS } from "../data";

type PurchaseState = "idle" | "approving" | "buying" | "success";

type TronMethod = {
  call: () => Promise<unknown>;
  send: (options?: { feeLimit?: number; shouldPollResponse?: boolean }) => Promise<unknown>;
};

type TronContract = {
  balanceOf?: (address: string) => TronMethod;
  approve?: (spender: string, amount: string) => TronMethod;
  buyTicket?: (quantity: string) => TronMethod;
};

type TronWebInjected = {
  ready?: boolean;
  defaultAddress?: { base58?: string };
  fullNode?: { host?: string };
  isAddress: (address: string) => boolean;
  contract: () => { at: (address: string) => Promise<TronContract> };
};

type TronLinkInjected = {
  request: (input: { method: string; params?: unknown }) => Promise<unknown>;
};

type TronWindow = typeof window & {
  tronLink?: TronLinkInjected;
  tronWeb?: TronWebInjected;
};

type LottoContextValue = {
  account: string | null;
  connect: () => Promise<void>;
  openBuy: () => void;
  lotteryAddress: string;
  isLive: boolean;
};

const LottoContext = createContext<LottoContextValue | null>(null);

const navItems = [
  { href: "/", label: "Live draw" },
  { href: "/history", label: "History" },
  { href: "/fairness", label: "Fairness" },
  { href: "/profile", label: "My tickets" },
];

function compactAccount(account: string) {
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
}

function getTronWindow(): TronWindow {
  return window as TronWindow;
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") return BigInt(value.toString());
  throw new Error("Unexpected TRON numeric response");
}

function transactionId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const id = record.txid ?? record.txID ?? record.id;
    if (typeof id === "string") return id;
    const transaction = record.transaction;
    if (transaction && typeof transaction === "object") {
      const nestedId = (transaction as Record<string, unknown>).txID;
      if (typeof nestedId === "string") return nestedId;
    }
  }
  throw new Error("Transaction ID was not returned");
}

function friendlyTronError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("cancel") || message.includes("reject")) return "The wallet request was rejected. No USDT moved.";
  if (message.includes("balance") || message.includes("insufficient")) return "Your USDT or TRX balance is insufficient. TRX is required for network energy.";
  if (message.includes("energy") || message.includes("bandwidth") || message.includes("fee")) return "TRON could not reserve enough energy or bandwidth. Add TRX and try again.";
  if (message.includes("revert") || message.includes("contract validate")) return "The lottery contract rejected this purchase. The draw may be closed or your ticket limit may be reached.";
  if (message.includes("timeout") || message.includes("network")) return "The TRON network did not respond in time. Check TronLink and retry.";
  return "The transaction could not be completed. No successful confirmation was received.";
}

function BuyDialog({ open, onOpenChange, account, connect, lotteryAddress, isLive }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string | null;
  connect: () => Promise<void>;
  lotteryAddress: string;
  isLive: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<PurchaseState>("idle");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const total = TICKET_PRICE * BigInt(quantity);

  useEffect(() => {
    if (!open || !account) return;
    let active = true;
    const loadBalance = async () => {
      try {
        const tronWeb = getTronWindow().tronWeb;
        if (!tronWeb) return;
        const usdt = await tronWeb.contract().at(TRON_USDT_ADDRESS);
        if (!usdt.balanceOf) throw new Error("USDT balanceOf unavailable");
        const result = await usdt.balanceOf(account).call();
        if (active) setBalance(asBigInt(result));
      } catch {
        if (active) setBalance(null);
      }
    };
    void loadBalance();
    return () => { active = false; };
  }, [account, open]);

  const resetAndClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.setTimeout(() => {
        setQuantity(1);
        setState("idle");
        setLastTransaction(null);
      }, 250);
    }
  };

  const purchase = async () => {
    if (!account) {
      await connect();
      return;
    }
    const tronWeb = getTronWindow().tronWeb;
    if (!tronWeb || !isLive || !tronWeb.isAddress(lotteryAddress)) {
      toast.error("Ticket sales are locked until the audited TRON contract address is activated.");
      return;
    }
    if (balance !== null && balance < total) {
      toast.error("Your USDT balance is too low for this purchase.");
      return;
    }
    try {
      setState("approving");
      const usdt = await tronWeb.contract().at(TRON_USDT_ADDRESS);
      if (!usdt.approve) throw new Error("USDT approve unavailable");
      await usdt.approve(lotteryAddress, total.toString()).send({ feeLimit: 100_000_000, shouldPollResponse: true });

      setState("buying");
      const lottery = await tronWeb.contract().at(lotteryAddress);
      if (!lottery.buyTicket) throw new Error("Lottery buyTicket unavailable");
      const result = await lottery.buyTicket(BigInt(quantity).toString()).send({ feeLimit: 300_000_000, shouldPollResponse: true });
      const txId = transactionId(result);
      setLastTransaction(txId);
      setState("success");
      toast.success(`${quantity} ticket${quantity > 1 ? "s" : ""} confirmed on TRON`);
    } catch (error) {
      setState("idle");
      toast.error(friendlyTronError(error));
    }
  };

  const isBusy = state === "approving" || state === "buying";

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1020]/95 p-0 text-zinc-100 shadow-2xl backdrop-blur-2xl sm:max-w-[520px]">
        <DialogHeader className="border-b border-white/[.07] px-6 pb-5 pt-6 text-left">
          <div className={`mb-2 flex items-center gap-2 text-sm font-medium ${isLive ? "text-emerald-300" : "text-amber-300"}`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? "live-dot bg-emerald-400" : "bg-amber-400"}`} /> {isLive ? "TRON Mainnet draw is open" : "Mainnet activation gate"}
          </div>
          <DialogTitle className="display-font text-2xl">Buy lottery tickets</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-zinc-400">
            Payment uses only USDT (TRC-20). Approval is limited to this exact purchase.
          </DialogDescription>
        </DialogHeader>

        {state === "success" ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400"><Check className="h-8 w-8" strokeWidth={2.5} /></div>
            <h3 className="display-font mt-5 text-2xl font-semibold">Confirmed on TRON</h3>
            <p className="mt-2 text-zinc-400">{quantity} ticket{quantity > 1 ? "s" : ""} secured for {formatUsdt(total)} USDT.</p>
            {lastTransaction && <a href={`https://tronscan.org/#/transaction/${lastTransaction}`} target="_blank" rel="noreferrer" className="mono mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 text-xs text-zinc-400 transition hover:text-white">View transaction <ExternalLink className="h-3.5 w-3.5" /></a>}
            <Button onClick={() => resetAndClose(false)} className="primary-gradient primary-glow mt-6 h-12 w-full rounded-xl text-base font-semibold">Done</Button>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
              <div><p className="text-sm text-zinc-400">Quantity</p><p className="mt-1 text-xs text-zinc-500">10 USDT per ticket · max 10 per transaction</p></div>
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-1.5">
                <button className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-zinc-300 disabled:opacity-35" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity === 1 || isBusy} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <span className="display-font min-w-5 text-center text-xl font-semibold" aria-live="polite">{quantity}</span>
                <button className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-zinc-300 disabled:opacity-35" onClick={() => setQuantity((value) => Math.min(10, value + 1))} disabled={quantity === 10 || isBusy} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="flex items-end justify-between px-1">
              <div><p className="text-sm text-zinc-400">Total</p><p className="display-font mt-1 text-3xl font-bold text-white">{formatUsdt(total)} <span className="text-base font-medium text-zinc-400">USDT</span></p></div>
              <p className="text-right text-sm text-zinc-500">Wallet balance<br/><span className="mono text-zinc-300">{balance === null ? "—" : `${formatUsdt(balance)} USDT`}</span></p>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/[.07] bg-black/15 p-4">
              <TransactionStep index={1} label="Approve exact USDT amount" active={state === "approving"} complete={state === "buying"} />
              <div className="ml-[15px] h-5 border-l border-dashed border-white/15" />
              <TransactionStep index={2} label="Buy tickets on TRON" active={state === "buying"} complete={false} />
            </div>

            <Button onClick={purchase} disabled={isBusy || (!!account && !isLive)} className="primary-gradient primary-glow h-12 w-full rounded-xl text-base font-semibold">
              {isBusy ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {state === "approving" ? "Confirm exact approval in TronLink" : "Confirm ticket purchase in TronLink"}</> : !account ? <><Wallet className="h-5 w-5" /> Connect TronLink</> : isLive ? <><Ticket className="h-5 w-5" /> Buy {quantity} ticket{quantity > 1 ? "s" : ""}</> : <><ShieldCheck className="h-5 w-5" /> Awaiting audited contract</>}
            </Button>
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5 ${isLive ? "bg-emerald-400/[.07] text-emerald-100/70" : "bg-amber-400/[.07] text-amber-100/70"}`}>
              <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${isLive ? "text-emerald-400" : "text-amber-400"}`} />
              {isLive ? "Transactions are sent directly from TronLink to the verified contracts. LottoChain never receives your private key." : "Real payments are deliberately disabled until a verified lottery contract address and treasury multisig are configured."}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionStep({ index, label, active, complete }: { index: number; label: string; active: boolean; complete: boolean }) {
  return <div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : active ? "border-violet-400/40 bg-violet-400/10 text-violet-300" : "border-white/10 bg-white/[.04] text-zinc-500"}`}>{complete ? <Check className="h-4 w-4" /> : active ? <LoaderCircle className="h-4 w-4 animate-spin" /> : index}</span><div className="flex-1"><p className={`text-sm font-medium ${active || complete ? "text-zinc-100" : "text-zinc-500"}`}>{label}</p><p className="mt-0.5 text-xs text-zinc-600">{complete ? "Confirmed" : active ? "Waiting for TronLink" : "Not started"}</p></div></div>;
}

export function ClientShell({ children, lotteryAddress }: { children: React.ReactNode; lotteryAddress: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const isLive = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(lotteryAddress);

  const connect = useCallback(async () => {
    const browserWindow = getTronWindow();
    try {
      if (!browserWindow.tronLink || !browserWindow.tronWeb) {
        toast.error("TronLink was not found. Install or open TronLink to continue.");
        return;
      }
      await browserWindow.tronLink.request({ method: "tron_requestAccounts" });
      const address = browserWindow.tronWeb.defaultAddress?.base58;
      if (!address) throw new Error("No TRON account returned");
      const host = browserWindow.tronWeb.fullNode?.host?.toLowerCase() ?? "";
      if (host.includes("shasta") || host.includes("nile")) {
        toast.warning("Switch TronLink to TRON Mainnet before purchasing.");
        return;
      }
      setAccount(address);
      toast.success("TronLink connected on TRON Mainnet");
    } catch (error) {
      toast.error(friendlyTronError(error));
    }
  }, []);

  const contextValue = useMemo(() => ({ account, connect, openBuy: () => setBuyOpen(true), lotteryAddress, isLive }), [account, connect, lotteryAddress, isLive]);

  return (
    <LottoContext.Provider value={contextValue}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#070b14]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg" aria-label="LottoChain home"><span className="primary-gradient primary-glow flex h-9 w-9 items-center justify-center rounded-xl"><Ticket className="h-5 w-5 text-white" /></span><span className="display-font text-lg font-bold tracking-tight text-white">Lotto<span className="text-violet-400">Chain</span></span></Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">{navItems.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`focus-ring rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "bg-white/[.07] text-white" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`}>{item.label}</Link>; })}</nav>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.03] px-3 py-2 text-xs text-zinc-400 sm:flex"><span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`} /> TRON Mainnet</div>
              <Button onClick={connect} className="focus-ring h-10 rounded-xl border border-violet-300/15 bg-violet-500/10 px-3 text-violet-100 hover:bg-violet-500/20 sm:px-4"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">{account ? compactAccount(account) : "Connect TronLink"}</span><span className="sm:hidden">{account ? compactAccount(account) : "Connect"}</span>{account && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}</Button>
              <button onClick={() => setMenuOpen((value) => !value)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.04] text-zinc-300 md:hidden" aria-expanded={menuOpen} aria-label="Toggle navigation">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            </div>
          </div>
          {menuOpen && <nav className="border-t border-white/[.06] bg-[#090e19] px-4 py-3 md:hidden" aria-label="Mobile navigation">{navItems.map((item) => <Link key={item.href} onClick={() => setMenuOpen(false)} href={item.href} className="focus-ring block rounded-lg px-3 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[.05]">{item.label}</Link>)}</nav>}
        </header>
        {children}
        <footer className="mt-24 border-t border-white/[.07] bg-black/10">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
            <div><div className="flex items-center gap-2.5"><span className="primary-gradient flex h-8 w-8 items-center justify-center rounded-lg"><Ticket className="h-4 w-4" /></span><span className="display-font font-bold text-white">LottoChain</span></div><p className="mt-4 max-w-xs text-sm leading-6 text-zinc-500">Transparent draws. Verifiable randomness. On-chain USDT settlement.</p><p className="mt-5 text-xs text-zinc-600">TRON Mainnet · USDT (TRC-20) · 18+ only</p></div>
            <FooterGroup title="Product" links={[{ label: "Live draw", href: "/" }, { label: "Draw history", href: "/history" }, { label: "My tickets", href: "/profile" }]} />
            <FooterGroup title="Security" links={[{ label: "How fairness works", href: "/fairness" }, { label: "Security model", href: "/security" }, { label: "VRF proof", href: "/draws/1042" }]} />
            <FooterGroup title="Legal" links={[{ label: "Terms & eligibility", href: "/terms" }, { label: "Restricted countries", href: "/terms#restricted" }, { label: "Responsible play", href: "/terms#responsible" }]} />
          </div>
          <div className="border-t border-white/[.06] px-4 py-5 text-center text-xs text-zinc-600">© 2026 LottoChain. Real-money access remains locked until contract, audit, and legal launch gates pass.</div>
        </footer>
      </div>
      <BuyDialog open={buyOpen} onOpenChange={setBuyOpen} account={account} connect={connect} lotteryAddress={lotteryAddress} isLive={isLive} />
      <Toaster position="bottom-right" richColors closeButton />
    </LottoContext.Provider>
  );
}

function FooterGroup({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return <div><h2 className="text-sm font-semibold text-zinc-200">{title}</h2><ul className="mt-4 space-y-3">{links.map((link) => <li key={link.href + link.label}><Link href={link.href} className="focus-ring rounded text-sm text-zinc-500 transition hover:text-zinc-200">{link.label}</Link></li>)}</ul></div>;
}

export function useLotto() {
  const value = useContext(LottoContext);
  if (!value) throw new Error("useLotto must be used within ClientShell");
  return value;
}
