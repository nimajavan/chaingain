// Interactive wallet, navigation, purchase dialog, and footer shared across LottoChain.
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
import { createContext, useCallback, useContext, useMemo, useState } from "react";
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
import { DEMO_WALLET, formatUsdc, TICKET_PRICE } from "../data";

type PurchaseState = "idle" | "approving" | "buying" | "success";

type LottoContextValue = {
  account: string | null;
  connect: () => Promise<void>;
  openBuy: () => void;
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

function BuyDialog({ open, onOpenChange, account, connect }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string | null;
  connect: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<PurchaseState>("idle");
  const total = TICKET_PRICE * BigInt(quantity);

  const resetAndClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.setTimeout(() => {
        setQuantity(1);
        setState("idle");
      }, 250);
    }
  };

  const purchase = async () => {
    if (!account) {
      await connect();
      toast.info("Wallet connected. Review the exact amount, then confirm.");
      return;
    }
    setState("approving");
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setState("buying");
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    setState("success");
    toast.success(`${quantity} ticket${quantity > 1 ? "s" : ""} added to Draw #1043`);
  };

  const isBusy = state === "approving" || state === "buying";

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1020]/95 p-0 text-zinc-100 shadow-2xl backdrop-blur-2xl sm:max-w-[520px]">
        <DialogHeader className="border-b border-white/[.07] px-6 pb-5 pt-6 text-left">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-300">
            <span className="live-dot h-2 w-2 rounded-full bg-emerald-400" /> Draw #1043 is open
          </div>
          <DialogTitle className="display-font text-2xl">Buy lottery tickets</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-zinc-400">
            Approval is limited to this purchase. LottoChain never requests unlimited USDC access.
          </DialogDescription>
        </DialogHeader>

        {state === "success" ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <h3 className="display-font mt-5 text-2xl font-semibold">You&apos;re in the draw</h3>
            <p className="mt-2 text-zinc-400">{quantity} ticket{quantity > 1 ? "s" : ""} secured for {formatUsdc(total)} USDC.</p>
            <div className="mono mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 text-xs text-zinc-400">
              Demo transaction <ExternalLink className="h-3.5 w-3.5" />
            </div>
            <Button onClick={() => resetAndClose(false)} className="primary-gradient primary-glow mt-6 h-12 w-full rounded-xl text-base font-semibold">Done</Button>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
              <div>
                <p className="text-sm text-zinc-400">Quantity</p>
                <p className="mt-1 text-xs text-zinc-500">10 USDC per ticket · max 10 per transaction</p>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-1.5">
                <button className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-zinc-300 disabled:opacity-35" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity === 1 || isBusy} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <span className="display-font min-w-5 text-center text-xl font-semibold" aria-live="polite">{quantity}</span>
                <button className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-zinc-300 disabled:opacity-35" onClick={() => setQuantity((value) => Math.min(10, value + 1))} disabled={quantity === 10 || isBusy} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="flex items-end justify-between px-1">
              <div>
                <p className="text-sm text-zinc-400">Total</p>
                <p className="display-font mt-1 text-3xl font-bold text-white">{formatUsdc(total)} <span className="text-base font-medium text-zinc-400">USDC</span></p>
              </div>
              <p className="text-right text-sm text-zinc-500">Balance<br/><span className="mono text-zinc-300">340.00 USDC</span></p>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/[.07] bg-black/15 p-4">
              <TransactionStep index={1} label="Approve exact USDC amount" active={state === "approving"} complete={state === "buying"} />
              <div className="ml-[15px] h-5 border-l border-dashed border-white/15" />
              <TransactionStep index={2} label="Buy tickets on-chain" active={state === "buying"} complete={false} />
            </div>

            <Button onClick={purchase} disabled={isBusy} className="primary-gradient primary-glow h-12 w-full rounded-xl text-base font-semibold">
              {isBusy ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {state === "approving" ? "Confirm approval in wallet" : "Confirm purchase in wallet"}</> : account ? <><Ticket className="h-5 w-5" /> Buy {quantity} ticket{quantity > 1 ? "s" : ""}</> : <><Wallet className="h-5 w-5" /> Connect wallet to continue</>}
            </Button>
            <div className="flex items-start gap-2 rounded-xl bg-amber-400/[.07] px-3 py-2.5 text-xs leading-5 text-amber-100/70">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              Preview mode: this interface simulates transactions; no funds move until audited contracts are deployed.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionStep({ index, label, active, complete }: { index: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : active ? "border-violet-400/40 bg-violet-400/10 text-violet-300" : "border-white/10 bg-white/[.04] text-zinc-500"}`}>
        {complete ? <Check className="h-4 w-4" /> : active ? <LoaderCircle className="h-4 w-4 animate-spin" /> : index}
      </span>
      <div className="flex-1">
        <p className={`text-sm font-medium ${active || complete ? "text-zinc-100" : "text-zinc-500"}`}>{label}</p>
        <p className="mt-0.5 text-xs text-zinc-600">{complete ? "Confirmed" : active ? "Waiting for your wallet" : "Not started"}</p>
      </div>
    </div>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const browserWindow = window as typeof window & {
      ethereum?: { request: (input: { method: string; params?: unknown[] }) => Promise<unknown> };
    };
    try {
      if (browserWindow.ethereum) {
        const result = await browserWindow.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = Array.isArray(result) ? result.filter((value): value is string => typeof value === "string") : [];
        if (!accounts[0]) throw new Error("No wallet account returned");
        try {
          await browserWindow.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13882" }] });
        } catch {
          toast.warning("Switch your wallet to Polygon Amoy to transact.");
        }
        setAccount(accounts[0]);
        toast.success("Wallet connected");
      } else {
        setAccount(DEMO_WALLET);
        toast.info("Demo wallet connected. Install a wallet extension for live signing.");
      }
    } catch {
      toast.error("Wallet connection was cancelled. Try again when you’re ready.");
    }
  }, []);

  const contextValue = useMemo(() => ({ account, connect, openBuy: () => setBuyOpen(true) }), [account, connect]);

  return (
    <LottoContext.Provider value={contextValue}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#070b14]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg" aria-label="LottoChain home">
              <span className="primary-gradient primary-glow flex h-9 w-9 items-center justify-center rounded-xl"><Ticket className="h-5 w-5 text-white" /></span>
              <span className="display-font text-lg font-bold tracking-tight text-white">Lotto<span className="text-violet-400">Chain</span></span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
              {navItems.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} className={`focus-ring rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "bg-white/[.07] text-white" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`}>{item.label}</Link>;
              })}
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.03] px-3 py-2 text-xs text-zinc-400 sm:flex">
                <span className="h-2 w-2 rounded-full bg-violet-400" /> Polygon Amoy
              </div>
              <Button onClick={connect} className="focus-ring h-10 rounded-xl border border-violet-300/15 bg-violet-500/10 px-3 text-violet-100 hover:bg-violet-500/20 sm:px-4">
                <Wallet className="h-4 w-4" /><span className="hidden sm:inline">{account ? compactAccount(account) : "Connect wallet"}</span><span className="sm:hidden">{account ? compactAccount(account) : "Connect"}</span>{account && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
              </Button>
              <button onClick={() => setMenuOpen((value) => !value)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.04] text-zinc-300 md:hidden" aria-expanded={menuOpen} aria-label="Toggle navigation">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            </div>
          </div>
          {menuOpen && (
            <nav className="border-t border-white/[.06] bg-[#090e19] px-4 py-3 md:hidden" aria-label="Mobile navigation">
              {navItems.map((item) => <Link key={item.href} onClick={() => setMenuOpen(false)} href={item.href} className="focus-ring block rounded-lg px-3 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[.05]">{item.label}</Link>)}
            </nav>
          )}
        </header>
        {children}
        <footer className="mt-24 border-t border-white/[.07] bg-black/10">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
            <div>
              <div className="flex items-center gap-2.5"><span className="primary-gradient flex h-8 w-8 items-center justify-center rounded-lg"><Ticket className="h-4 w-4" /></span><span className="display-font font-bold text-white">LottoChain</span></div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-500">Transparent draws. Verifiable randomness. Non-custodial payouts.</p>
              <p className="mt-5 text-xs text-zinc-600">Preview on Polygon Amoy · 18+ only</p>
            </div>
            <FooterGroup title="Product" links={[{ label: "Live draw", href: "/" }, { label: "Draw history", href: "/history" }, { label: "My tickets", href: "/profile" }]} />
            <FooterGroup title="Security" links={[{ label: "How fairness works", href: "/fairness" }, { label: "Security model", href: "/security" }, { label: "VRF proof", href: "/draws/1042" }]} />
            <FooterGroup title="Legal" links={[{ label: "Terms & eligibility", href: "/terms" }, { label: "Restricted countries", href: "/terms#restricted" }, { label: "Responsible play", href: "/terms#responsible" }]} />
          </div>
          <div className="border-t border-white/[.06] px-4 py-5 text-center text-xs text-zinc-600">© 2026 LottoChain. Smart-contract preview; not an offer to gamble.</div>
        </footer>
      </div>
      <BuyDialog open={buyOpen} onOpenChange={setBuyOpen} account={account} connect={connect} />
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
