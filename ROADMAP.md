# Elysium Explorer — roadmap (done / remaining)

Goal: match everything Etherscan does (no public API menu) and stay ahead of the rival explorer elyscan.live.
Each item notes what it is, why it matters, and a rough effort. Items marked **Operator decision** need a call
from whoever runs the deployment before they're built.

---

## Short list: what's still missing

**Done (browser-verified, no console errors):** the top "Transaction Action" line, buy/sell fee detection
(how much, to whom, what percentage), and the internal money flow — i.e. the HYPE released on a sell, with its
full path, plus an All / Net toggle. Everything below is not done yet.

**Missing, no decision needed:**
1. "State" tab on a transaction: each address's balance before and after.
2. Prev / next arrows between transactions.
3. Timestamp toggle between local time and UTC.
4. Token prices, computed from pools — this unlocks USD everywhere.
5. Address-page extras: who funded it first, first/last activity, value of tokens held.
6. Token page: pool trades (DEX trades) and a price chart (after prices exist).
7. Contract "Verify & Publish" page (authors verify their own source).
8. Withdrawal tracker with a countdown.
9. Home page: "posted to L1", transactions per second, live-updating lists, batches page.
10. "Add Elysium to wallet" button and a network page (needs a public network endpoint — see below).

**Missing, needs an operator decision:**
- Wallet tool + QR code (for Read/Write Contract).
- Bridge page, with real money (test on a fork first).
- A public network RPC endpoint and publishing the site.
- The explorer's final brand name.

**Mandatory before going public:** per-visitor rate limiting, a cap on table downloads, a bound on heavy
per-address counting — see section 6.

---

## 1. Transaction page, Etherscan-style

Already present: tokens transferred with amounts (from / to / how much), the HYPE amount with its USD value,
the fee in USD, gas price, block confirmations, and known address names.

**Done (browser-verified):**
- The top **"Transaction Action"** line for approve / swap / transfer / burn / call.
- **Buy/sell fees**: how much, to whom, what percentage — works on any platform, catches referral cuts too.
- **"Internal Transactions" and "ERC-20 Tokens Transferred" on the main page**, each with an
  **All Transfers / Net Transfers** toggle. This also shows where the HYPE released on a sell goes, not just
  the token.

**Still missing vs. the Etherscan reference:**
1. **"Transaction Action" line** — a one-line plain-language summary, e.g.
   "Approve 1.00 B ORIGO for Trade on 0x4217…", "Swap 1 HYPE for 1,485,929 AK on ElysPump",
   "Call method 0x2b1672e1 on 0x12f4…" when the function is unknown. For approvals the amount is read from the
   transaction data even when no token moves. (~3–4 h)
2. **Internal Transactions on the main page** — each HYPE amount moved by a contract during the tx. (~1–2 h)
3. **All Transfers / Net Transfers toggle** for both HYPE and tokens. "Net" nets everything and shows only what
   each address gained or lost. (~2 h)
4. **"ERC-20 Tokens Transferred: 2"** title with a count badge, token logo, and the "ERC-20: Origo (ORIGO)"
   form. (~1 h)
5. **"State" tab** — each address's HYPE and token balance before and after, read from the node. (~3–4 h)
6. **Prev / next "<" ">" arrows** — the sender's previous and next transaction. (~1 h)
7. **Timestamp toggle** — local time vs UTC. (~30 min)
8. **USD amounts for tokens** — shown where the token has a price (see 4.1).
9. **Buy/sell fees** — when someone buys or sells, show how much went to fees, to whom, and what percentage, e.g.
   "Fee 3%: 2% (0.0698 HYPE) to the platform, 1% (0.0349 HYPE) to the buyback contract". Works on any platform
   with no platform list — it sums who received money at the end, excluding the trader and the pool; what's left
   is the fee. Works whether the fee is taken from HYPE or from the token. (~3 h)

Deliberately NOT copied: "Sponsored" (ad slot) and "Private Note" (needs an account/login).

---

## 2. What elyscan.live has that this doesn't (to overtake it)

elyscan.live is an independent third-party explorer, not run by the Elysium team.

1. **Withdrawal search** by address or tx hash, with the steps shown: sent, pending, claimable, paid. Data is
   available (bridge tracking can be turned on). Add a countdown until a withdrawal is claimable — the wait is
   483,840 HyperEVM blocks (~5.5 days). (~3 h)
2. **Home page**: how much has reached HyperEVM ("Posted to L1: block X, N blocks ago"), transactions per
   second, a "hide system transactions" toggle, and lists that refresh without a reload. (~3–4 h)
3. **Batches page** (like Arbiscan): each batch posted to HyperEVM, with its tx count and time; a block/tx shows
   which batch it's in. (~3 h)
4. **"Add Elysium to wallet" button** + a network-info page. Needs a public network RPC endpoint (see 2.7).
   Network data: chain id 99901, coin HYPE. (~1–2 h)
5. **Watchlist + custom address labels**, kept in the browser (no account), plus private notes on
   transactions. (~3 h)
6. **Bridge page**: deposit HYPE from HyperEVM into Elysium, withdraw, and claim. Needs the wallet tool
   (section 5). Handles real money — test on a fork first, then a tiny amount, then ship. (~1–2 days)
   **Operator decision.**
7. **A public network RPC endpoint** anyone can add to their wallet (they have rpc.elyscan.live). Means exposing
   the node to the internet with limits and protection; only makes sense alongside publishing the site.
   **Operator decision.**

---

## 3. Where this is already better than elyscan

- **Verified contracts show their source** (e.g. the ElysPump swap contract — verified here, "unverified" there).
- **Exact counts** where they show "2,000+".
- **Pages not found in their menus:** deposits list (HyperEVM → Elysium), charts, gas price, unit converter,
  input-data decoder, balance-at-a-date check, broadcast signed transaction, token holder analysis, NFT inventory.
- **Convenience & safety:** light/dim/dark themes, settings, a warning when copying an address that resembles
  another on the page, same-address highlighting across the page, column toggles (age/date, amount/USD,
  fee/gas-price), table download.
- **.eth names** and decoded names of called functions.

---

## 4. What's still missing vs. Etherscan

1. **Token prices.** Today only HYPE has a price. Compute each token's price from its Elysium swap pools (how
   much HYPE per token), like any DEX. Then USD appears everywhere — tokens, holders, transfers, the tx page.
   (~1 day)
2. **Read / Write Contract tabs** on verified contracts, plus an address **QR code**. Need the two external tools
   (section 5). (~1 day) **Operator decision.**
3. **"Verify & Publish" page** where a contract author publishes their own source. (~1 day)
4. **Token page:** a "DEX Trades" tab (pool buys/sells) and a price chart (after 4.1). (~1 day)
5. **Address page:** "Funded By" (who sent the first funds), first/last sent tx, held-tokens menu with USD
   values (after 4.1). (~half a day)
6. **Richer daily stats** on the charts page (active addresses, fees/day, etc.). Deferred.
7. **Leftovers:** the "Action / Method" toggle in lists; the small preview popup on the eye icon.
   "Failed-only" / "pending" filters are not possible: the engine has no failed filter and Elysium has no public
   mempool.

---

## 5. Operator decisions

1. **Wallet tool (viem):** for Read/Write Contract and the bridge page. Third-party code, version-pinned.
2. **QR-code tool:** third-party code, version-pinned.
3. **Bridge page:** whether to build it, with fork testing then a tiny amount.
4. **Public network endpoint** and **publishing the site**: when and on what domain.
5. **Final name** for the explorer ("Elysium Explorer" is a working title).
6. **Stats microservice:** deferred.

---

## 6. Before going public (mandatory)

- Per-visitor request rate limiting. It is currently off because the site runs only locally.
- A cap on table downloads.
- A bound on heavy counting for very busy addresses.
- Protection on the public network endpoint, if exposed, so nobody can overwhelm the node.
- The "broadcast signed transaction" page hits the real network and is left untested with money, on purpose.

---

## 7. Useful chain facts

- Network: Elysium, chain id 99901, coin HYPE. Parent chain: HyperEVM, chain id 999.
- Bridge contracts on HyperEVM:
  - Rollup: `0x508C173dFe5F737B3493195Bf785d71fA76fD217`
  - Bridge: `0x503D572157113fAaaD4DbeD2647Bb10b949216B6`
  - Inbox: `0xce59f8B65ad41C9DAE4c07A0571a39824bD92cff`
  - SequencerInbox: `0x7f3Ff53aecB87261206ad3bDc27A88b6D8420fa6`
  - Outbox: `0xeC6B106DfA14428FE5Eec2a4065a7be599f02728`
- On Elysium, withdrawals are started via ArbSys at `0x0000000000000000000000000000000000000064`.
- Network created at HyperEVM block 48,956,737.
- Withdrawal challenge window: 483,840 HyperEVM blocks (~0.98 s/block ≈ ~5.5 days).
- Batches post to HyperEVM roughly every 3 hours.
- Rough scale (early Nov 2026): ~145,000 Elysium blocks, ~580,000 transactions, ~1,345 ERC-20 tokens.

## Suggested order

1. Transaction page (section 1).
2. No-decision items: home page with "Posted to L1" and live lists, batches page, withdrawal search with
   countdown, add-to-wallet button, watchlist with labels.
3. Token prices from pools (USD everywhere).
4. Decision-gated items: wallet tool (Read/Write Contract, bridge), QR code, public endpoint.
5. Go-public hardening (section 6) before any publishing.
