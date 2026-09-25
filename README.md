# MAMBA Wallet

A React public website and wallet app backed by Express and Tether WDK. The public MAMBA site describes only features present in this project; the protected wallet remains at `/app`.

## Project Structure

```text
.
|-- apps/
|   |-- web/
|   |   |-- public/mamba-logo.jpg
|   |   |-- src/
|   |   |   |-- app/App.jsx     App shell, auth, and wallet screens
|   |   |   |-- site/           Public pages, feature pages, and site styles
|   |   |   |-- main.jsx        React entry point
|   |   |   `-- styles.css      Shared MAMBA theme and layout
|   |   |-- index.html
|   |   |-- package.json
|   |   `-- vite.config.js
|   `-- api/
|       |-- data/               Local encrypted user vaults, ignored by Git
|       |-- src/
|       |   |-- app.js          Express API and WDK-backed handlers
|       |   `-- server.js       HTTP server entry point
|       `-- package.json
|-- packages/
|   `-- api-contracts/
|       |-- src/index.js        Shared credential and address validation
|       `-- package.json
|-- tests/
|   `-- wallet-validation.test.js
|-- .env                        Local providers; ignored by Git
|-- .env.example
|-- .gitignore
|-- package-lock.json
`-- package.json
```

The root package manages the `apps/web`, `apps/api`, and `packages/api-contracts` npm workspaces. The app stays JavaScript-based to preserve the current implementation; TypeScript, Prisma, React Router, and state/query libraries are not added because the current app does not use them.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open the public site at `http://127.0.0.1:5173` and the protected wallet at `http://127.0.0.1:5173/app`.

## Public Pages

- `/` home and product overview
- `/features/multichain`, `/features/send-receive`, `/features/swaps`, `/features/portfolio`, `/features/activity`
- `/developers` explains the WDK integration; MAMBA does not currently offer a public SDK or developer API
- `/updates` currently has no published posts
- `/trust` and `/risks` describe the current implementation and its limitations
- `/privacy` and `/terms` are drafts and require legal and owner review before publication

## Environment

The app uses testnets/devnets by default:

- Bitcoin: Electrum testnet server
- EVM: Polygon Amoy JSON-RPC
- Solana: devnet JSON-RPC

Production or mainnet use should switch these values to reliable paid or self-hosted providers:

```bash
EVM_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
EVM_CHAIN_ID=80002
EVM_SWAP_MAX_FEE_WEI=200000000000000
BTC_ELECTRUM_HOST=electrum.blockstream.info
SOLANA_RPC_URL=https://api.devnet.solana.com
PORT=8787
```

## Security Model

- Registration generates a unique WDK mnemonic per user.
- The mnemonic is encrypted server-side with AES-256-GCM using a key derived from the user's password.
- The browser stores no raw seed, private key, or mnemonic.
- Normal wallet APIs return only public addresses, balances, QR codes, quotes, and transaction results.
- Seed reveal requires password re-authentication plus typing `REVEAL_SEED`.
- `.env` and `apps/api/data/*.json` are ignored by Git.

## WDK Modules

- `@tetherto/wdk`: core orchestrator
- `@tetherto/wdk-wallet-btc`: Bitcoin wallet manager
- `@tetherto/wdk-wallet-evm`: EVM wallet manager
- `@tetherto/wdk-wallet-solana`: Solana wallet manager
- `@tetherto/wdk-protocol-swap-velora-evm`: EVM ERC-20 swap quotes and swaps through Velora

The backend follows the WDK flow from the docs: configure providers, initialize `WDK` with a mnemonic, register wallet managers, then use account methods for address, balance, quote, and send operations. EVM swaps use the documented Velora protocol module with quote-first and password-confirmed broadcast.

## Current Advanced Features

- Custom EVM token tracking by contract address.
- Portfolio asset list with pricing placeholders.
- Receive screen with QR codes and network warnings.
- Transaction/activity center with server-side activity and notifications.
- Address book with saved trusted recipients.
- Password confirmation before native sends and swaps.
- Privacy toggle for hiding balances.
- Auto-lock after inactivity and manual logout.

## Planned Provider Integrations

- Fiat prices and 24h change need a pricing provider/API.
- Full historical receive/swap/approval indexing needs an indexer provider.
- WalletConnect needs a WalletConnect project id and session/signing controller.
- Approval listing/revoke needs either an approvals indexer or direct allowance targets to inspect.

## Safe Testing

1. Register a new local account.
2. Use testnet/devnet faucets only.
3. Start with address and balance checks.
4. Use transaction preview before broadcasting.
5. Never fund this demo with production assets.
