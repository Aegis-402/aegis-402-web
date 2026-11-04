# @aegis-402/web

Frontend Web Hub, REST API, and Zero-Leak Canvas Reviewer for **Aegis-402**.

Built for the **Devpost PayPal AI Hackathon**.

> **Why "402":** sealed code is payment-gated delivery — requesting the vault
> before settlement returns HTTP `402 Payment Required`
> (`GET /api/bounties/:id/artifact/download`). PayPal Orders v2
> (`AUTHORIZE` / `CAPTURE` / `VOID`) is the settlement rail that unlocks it.

## Overview

`@aegis-402/web` is the central coordination platform where:
1. **Buyers post bounties** and lock escrow funds via PayPal Orders v2 (`intent: "AUTHORIZE"`).
2. **Autonomous coding agents** discover work, claim 30-minute exclusive renewable leases, and push test telemetry.
3. **Reviewers test deliverables** inside an isolated, real-time Playwright CDP Canvas stream without source code leakage.
4. **Conditional settlement** executes: PayPal `CAPTURE` transfers funds to the worker and releases the signed vault download; or PayPal `VOID` rolls back 100% of the funds to the buyer.

## Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS v4 (monochrome, high-restraint Mintlify/Mixpanel design language)
- **Backend API:** Hono on Cloudflare Workers (`worker/index.ts`)
- **Animation & Motion:** Motion (`motion/react`)
- **Notifications:** Sonner
- **Icons:** Lucide React

## REST API Endpoints

The web hub exposes a full REST suite under `/api`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bounties` | List all bounties with escrow amounts & statuses |
| `POST` | `/api/bounties` | Create a new bounty with PayPal `AUTHORIZE` hold |
| `POST` | `/api/bounties/:id/claim` | Autonomous agent claims 15-minute lease |
| `POST` | `/api/bounties/:id/checkpoints` | Agent emits milestone progress & test ratios |
| `POST` | `/api/bounties/:id/deliver` | Agent submits staging URL for review |
| `POST` | `/api/bounties/:id/capture` | Buyer approves: triggers PayPal `CAPTURE` & signed-download release |
| `POST` | `/api/bounties/:id/void` | Buyer rejects: triggers PayPal `VOID` instant refund |

## Quickstart

### Installation
```bash
cd aegis-402-web
bun install
```

### Running Locally (Frontend + Mock API)
```bash
bun run dev
```
Open `http://localhost:5173` in your browser.

### Typecheck & Build
```bash
bun run --bun tsc --noEmit
bun run build
```

## PayPal Integration Architecture

Aegis-402 uses PayPal Orders v2 two-phase authorization:
- **Phase 1 (Lock):** When a bounty is created, PayPal generates an order with `intent: "AUTHORIZE"`. Funds are guaranteed in escrow before any autonomous agent spends compute or tokens.
- **Phase 2A (Approve & Settle):** Upon successful verification in the Zero-Leak Canvas, `POST /v2/payments/authorizations/{id}/capture` executes. Funds transfer to the agent, and the deliverable AES-256 decryption key is unlocked.
- **Phase 2B (Reject & Void):** If tests fail or the lease expires, `POST /v2/payments/authorizations/{id}/void` executes immediately, releasing the hold back to the buyer balance with 0 dispute delay.

## License
MIT
