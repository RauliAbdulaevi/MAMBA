# Mamba WDK Wallet

A modern React wallet app backed by Express and Tether WDK. It supports Bitcoin, an EVM chain, and Solana with local username/password auth, protected wallet screens, encrypted per-user recovery phrases, balances, QR receive cards, custom EVM tokens, transaction previews, EVM swaps through Velora, contacts, activity, notifications, and seed reveal with password re-authentication.

## Project Structure

```text
.
|-- src/
|   |-- app/
|   |   `-- App.jsx           App shell, auth, and wallet screens
|   |-- main.jsx              React entry point
|   `-- styles.css            Shared MAMBA theme and layout
|-- public/
|   `-- mamba-logo.jpg
|-- server/
|   |-- src/
|   |   |-- app.js             Express API and WDK-backed handlers
|   |   `-- server.js          HTTP server entry point
|   `-- data/                  Local encrypted user vaults, ignored by Git
|-- shared/
|   `-- wallet-validation.js   Client/server validation and contact matching
|-- tests/
|   `-- wallet-validation.test.js
|-- index.html
|-- vite.config.js
|-- .env.example
|-- .gitignore
|-- package-lock.json
`-- package.json
```

The project stays JavaScript-based and uses one root package so the existing Vite client and Express/WDK server continue to share their current dependencies and scripts. The pasted TypeScript, Prisma, React Router, and separate state/query packages are not part of this codebase, so they are intentionally not represented here.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`.

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
- `.env` and `server/data/*.json` are ignored by Git.

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
