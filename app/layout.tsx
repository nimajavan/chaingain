// Root metadata and shared application shell for LottoChain.
import type { Metadata } from "next";
import "./globals.css";
import { ClientShell } from "./components/client-shell";

// Read public chain configuration at request time, not from the build machine.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "LottoChain — Provably fair on-chain draws", template: "%s · LottoChain" },
  description: "A transparent on-chain lottery using USDT on TRON and verifiable WINkLink randomness.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lotteryAddress = process.env.TRON_LOTTERY_ADDRESS ?? "";
  const paymentTokenAddress = process.env.TRON_PAYMENT_TOKEN_ADDRESS ?? "";
  const network = (process.env.TRON_NETWORK ?? "prelaunch").toLowerCase();
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <ClientShell lotteryAddress={lotteryAddress} paymentTokenAddress={paymentTokenAddress} network={network}>{children}</ClientShell>
      </body>
    </html>
  );
}
