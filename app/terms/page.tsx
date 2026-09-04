// Plain-language pre-launch terms, eligibility, and responsible-play information.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Pre-launch legal framework</p>
      <h1 className="display-font mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Terms & eligibility</h1>
      <p className="mt-4 text-base leading-7 text-zinc-500">Last updated September 4, 2026. This page is a product placeholder, not jurisdiction-specific legal advice or a production gambling license.</p>
      <div className="mt-10 space-y-4">
        <TermSection title="1. Launch status"><p>LottoChain is configured for USDT on TRON Mainnet, but real-value ticket sales stay locked until the audited lottery contract, treasury permissions, oracle funding, and jurisdictional approval are in place. Sample draw records remain illustrative.</p></TermSection>
        <TermSection title="2. Eligibility"><p>You must be at least 18 years old and legally permitted to participate where you are physically located. A wallet connection does not establish eligibility.</p></TermSection>
        <TermSection title="3. Non-custodial operation"><p>When production contracts are deployed, ticket funds will move directly between a participant wallet and the smart contract. LottoChain will not hold user balances or private keys.</p></TermSection>
        <TermSection title="4. Draw mechanics"><p>Each ticket costs 10 USDT on TRON. WINkLink VRF selects the winning ticket after the scheduled deadline. The contract allocates 70% of the pool to the winner and 30% to the treasury. These values must be hard-coded and publicly verifiable.</p></TermSection>
        <TermSection title="5. Refunds"><p>If the minimum player threshold is not met, the production contract is intended to return participant spend on-chain. Network fees and third-party wallet behavior remain outside LottoChain&apos;s control.</p></TermSection>
        <TermSection id="restricted" title="6. Restricted countries"><p>Participation must be blocked in every country or region where online lottery, prize competition, sanctions, age, consumer-protection, or payment law prohibits the service. The final list requires advice from counsel in the launch jurisdiction and each target market.</p></TermSection>
        <TermSection id="responsible" title="7. Responsible play"><p>Set a strict entertainment budget, never borrow to participate, and stop if play causes stress or financial harm. Self-exclusion, deposit limits, cooling-off controls, and links to local support services are mandatory before a real-money release.</p></TermSection>
        <TermSection title="8. Risk disclosure"><p>Smart contracts, token transfers, wallets, RPC providers, and blockchains may fail or behave unexpectedly. A security review reduces risk but cannot eliminate it. Do not send funds to undeployed or unverified addresses.</p></TermSection>
      </div>
    </main>
  );
}

function TermSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="glass scroll-mt-28 rounded-[20px] p-6"><h2 className="display-font text-xl font-semibold text-white">{title}</h2><div className="mt-3 text-sm leading-7 text-zinc-500">{children}</div></section>;
}
