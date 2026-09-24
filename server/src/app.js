import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import QRCode from 'qrcode'
import WDK from '@tetherto/wdk'
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'
import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm'
import { Contract, JsonRpcProvider, formatUnits, isAddress } from 'ethers'
import { getCredentialValidationError } from '../../shared/wallet-validation.js'

loadLocalEnv()

const app = express()
const port = Number(process.env.PORT || 8787)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const distDir = path.join(rootDir, 'dist')
const dataDir = path.join(rootDir, 'server', 'data')
const usersFile = path.join(dataDir, 'users.json')
const sessions = new Map()
const cookieName = 'mamba_sid'
const erc20Abi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)'
]

app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'mamba-wallet' })
})

app.post('/api/auth/register', async (request, response) => {
  try {
    const { username, password } = parseCredentials(request.body)
    const store = readUserStore()

    if (store.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      throw new PublicError('That username is already registered.', 'Sign in or choose a different username.')
    }

    const mnemonic = normalizeMnemonic(request.body?.mnemonic) || WDK.getRandomSeedPhrase(12)
    if (!WDK.isValidSeed(mnemonic)) {
      throw new Error('Generated seed phrase failed WDK validation.')
    }

    const passwordSalt = randomBase64(16)
    const seedVault = await encryptMnemonic(mnemonic, password)
    const user = {
      id: crypto.randomUUID(),
      username,
      passwordSalt,
      passwordHash: await hashPassword(password, passwordSalt),
      seedVault,
      tokens: [],
      contacts: [],
      activity: [],
      notifications: [],
      backupConfirmed: Boolean(request.body?.mnemonic),
      createdAt: new Date().toISOString()
    }

    store.users.push(user)
    writeUserStore(store)
    setSession(response, user.id, await deriveKey(password, seedVault.salt))
    response.status(201).json({ ok: true, user: publicUser(user) })
  } catch (error) {
    sendError(response, error, 'Registration failed.')
  }
})

app.post('/api/auth/login', async (request, response) => {
  try {
    const { username, password } = parseCredentials(request.body)
    const user = findUser(username)
    if (!user || !(await verifyPassword(user, password))) {
      throw new PublicError('Invalid username or password.', 'Check your details and try again.')
    }

    setSession(response, user.id, await deriveKey(password, user.seedVault.salt))
    response.json({ ok: true, user: publicUser(user) })
  } catch (error) {
    sendError(response, error, 'Login failed.')
  }
})

app.post('/api/auth/logout', (request, response) => {
  const sid = getSessionId(request)
  if (sid) sessions.delete(sid)
  clearSession(response)
  response.json({ ok: true })
})

app.get('/api/auth/me', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json({ ok: true, user: publicUser(user) })
})

app.get('/api/wallet', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return

  const config = readConfig()
  if (!config.ok) {
    response.status(503).json({
      ok: false,
      message: 'Wallet provider configuration is incomplete.',
      action: 'Create a .env file from .env.example and fill in the missing provider values.',
      missing: config.missing
    })
    return
  }

  let wdk
  try {
    const mnemonic = await decryptMnemonic(user.seedVault, null, request)
    wdk = createWdk(mnemonic, config.value)
    const specs = getChainSpecs(config.value)
    const accounts = await Promise.all(specs.map((spec) => wdk.getAccount(spec.id, 0)))
    const chains = await Promise.all(specs.map((spec, index) => buildChainSummary(spec, accounts[index])))
    const assets = await buildAssets(user, chains, config.value)

    response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      user: publicUser(user),
      chains,
      assets,
      portfolio: buildPortfolio(assets),
      architecture: 'WDK runs on the Express server. The browser receives addresses, QR codes, balances, quotes, and transaction results only.'
    })
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: 'The wallet could not be initialized.',
      action: 'Check provider configuration and try again.',
      detail: friendlyError(error)
    })
  } finally {
    wdk?.dispose()
  }
})

app.post('/api/quote', async (request, response) => {
  await handleTransactionRequest(request, response, 'quote')
})

app.post('/api/send', async (request, response) => {
  await handleTransactionRequest(request, response, 'send')
})

app.get('/api/networks', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return

  const config = readConfig()
  if (!config.ok) {
    response.status(503).json({ ok: false, message: 'Network configuration is incomplete.', missing: config.missing })
    return
  }

  response.json({
    ok: true,
    networks: getChainSpecs(config.value).map((chain) => ({
      id: chain.id,
      name: chain.name,
      networkLabel: chain.networkLabel,
      mainnet: chain.id === 'bitcoin' ? chain.networkLabel === 'bitcoin' : chain.id === 'solana' ? chain.networkLabel === 'mainnet-beta' : !/amoy|test|sepolia/i.test(chain.name),
      warning: chain.id === 'evm' && !/amoy|test|sepolia/i.test(chain.name) ? 'Mainnet swaps and sends use real assets.' : null
    }))
  })
})

app.get('/api/activity', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json({ ok: true, activity: getUser(user.id).activity || [] })
})

app.get('/api/notifications', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json({ ok: true, notifications: getUser(user.id).notifications || [] })
})

app.get('/api/address-book', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json({ ok: true, contacts: getUser(user.id).contacts || [] })
})

app.post('/api/address-book', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return

  try {
    const name = requireText(request.body?.name, 'Contact name is required.')
    const chain = requireText(request.body?.chain, 'Network is required.')
    const address = requireText(request.body?.address, 'Address is required.')
    validateAddress(chain, address)

    const contact = { id: crypto.randomUUID(), name, chain, address, createdAt: new Date().toISOString() }
    const updated = updateUser(user.id, (draft) => {
      draft.contacts = [contact, ...(draft.contacts || [])]
    })
    addNotification(updated.id, 'security', `Saved trusted address: ${name}`)
    response.status(201).json({ ok: true, contact })
  } catch (error) {
    sendError(response, error, 'Could not save contact.')
  }
})

app.post('/api/tokens', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return

  try {
    const address = requireText(request.body?.address, 'Token contract address is required.')
    if (!isAddress(address)) {
      throw new PublicError('Enter a valid EVM token contract.', 'Token contracts on EVM networks start with 0x.')
    }

    const config = readConfig()
    if (!config.ok) {
      response.status(503).json({ ok: false, message: 'Network configuration is incomplete.', missing: config.missing })
      return
    }

    const metadata = await fetchEvmTokenMetadata(address, config.value.evmRpcUrl)
    const token = {
      id: crypto.randomUUID(),
      chain: 'evm',
      address,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      createdAt: new Date().toISOString()
    }

    updateUser(user.id, (draft) => {
      draft.tokens = [token, ...(draft.tokens || []).filter((item) => item.address.toLowerCase() !== address.toLowerCase())]
    })
    addNotification(user.id, 'asset', `Added ${token.symbol} to the EVM token list.`)
    response.status(201).json({ ok: true, token })
  } catch (error) {
    sendError(response, error, 'Could not add token.')
  }
})

app.post('/api/profile/backup-confirmed', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  updateUser(user.id, (draft) => {
    draft.backupConfirmed = true
  })
  addNotification(user.id, 'security', 'Recovery phrase backup was marked complete.')
  response.json({ ok: true })
})

app.post('/api/swap/quote', async (request, response) => {
  await handleSwapRequest(request, response, 'quote')
})

app.post('/api/swap/send', async (request, response) => {
  await handleSwapRequest(request, response, 'send')
})

app.post('/api/profile/reveal-seed', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return

  try {
    const password = requireText(request.body?.password, 'Password is required.')
    if (request.body?.confirmation !== 'REVEAL_SEED') {
      throw new PublicError('Explicit confirmation is required.', 'Type REVEAL_SEED before revealing the recovery phrase.')
    }

    if (!(await verifyPassword(user, password))) {
      throw new PublicError('Password re-authentication failed.', 'Enter your account password to reveal the recovery phrase.')
    }

    const mnemonic = await decryptMnemonic(user.seedVault, password)
    response.json({
      ok: true,
      mnemonic,
      warning: 'Anyone with this phrase can control the wallet. Do not share it.'
    })
  } catch (error) {
    sendError(response, error, 'Could not reveal recovery phrase.')
  }
})

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'))
  })
}

async function handleTransactionRequest(request, response, mode) {
  const user = requireUser(request, response)
  if (!user) return

  const config = readConfig()
  if (!config.ok) {
    response.status(503).json({
      ok: false,
      message: 'Wallet provider configuration is incomplete.',
      action: 'Create a .env file from .env.example and fill in the missing provider values.',
      missing: config.missing
    })
    return
  }

  let wdk
  try {
    if (mode === 'send') {
      await requirePasswordCheck(user, request.body?.password)
    }

    const tx = parseNativeTransaction(request.body ?? {}, config.value)
    const mnemonic = await decryptMnemonic(user.seedVault, null, request)
    wdk = createWdk(mnemonic, config.value)
    const account = await wdk.getAccount(tx.chain, 0)

    if (mode === 'quote') {
      const quote = await account.quoteSendTransaction({ to: tx.to, value: tx.value })
      response.json({
        ok: true,
        chain: tx.chain,
        chainName: tx.spec.name,
        symbol: tx.spec.symbol,
        network: tx.spec.networkLabel,
        to: tx.to,
        amount: tx.amount,
        value: tx.value.toString(),
        fee: quote.fee.toString(),
        feeDisplay: formatBaseUnits(quote.fee, tx.spec),
        totalDisplay: formatBaseUnits(tx.value + quote.fee, tx.spec)
      })
      return
    }

    const result = await account.sendTransaction({ to: tx.to, value: tx.value })
    const hash = result.hash ?? result.txid ?? result.signature
    recordActivity(user.id, {
      type: 'send',
      chain: tx.chain,
      asset: tx.spec.symbol,
      amount: tx.amount,
      status: 'success',
      hash,
      link: hash ? buildTxLink(tx.spec, hash) : null,
      to: tx.to
    })
    response.json({
      ok: true,
      chain: tx.chain,
      chainName: tx.spec.name,
      symbol: tx.spec.symbol,
      hash,
      link: hash ? buildTxLink(tx.spec, hash) : null,
      fee: result.fee?.toString?.() ?? null,
      feeDisplay: result.fee !== undefined ? formatBaseUnits(result.fee, tx.spec) : null
    })
  } catch (error) {
    if (mode === 'send' && user?.id) {
      recordActivity(user.id, {
        type: 'send',
        chain: request.body?.chain || 'unknown',
        asset: 'native',
        amount: request.body?.amount || '',
        status: 'failed',
        hash: null,
        link: null,
        to: request.body?.to || '',
        detail: friendlyError(error)
      })
    }
    response.status(400).json({
      ok: false,
      message: mode === 'quote' ? 'Could not preview this transaction.' : 'Could not send this transaction.',
      action: 'Check the recipient, amount, wallet balance, and configured provider.',
      detail: friendlyError(error)
    })
  } finally {
    wdk?.dispose()
  }
}

async function handleSwapRequest(request, response, mode) {
  const user = requireUser(request, response)
  if (!user) return

  const config = readConfig()
  if (!config.ok) {
    response.status(503).json({ ok: false, message: 'Wallet provider configuration is incomplete.', missing: config.missing })
    return
  }

  let wdk
  try {
    const swap = parseSwapRequest(request.body || {}, config.value)
    if (mode === 'send') {
      await requirePasswordCheck(user, request.body?.password)
    }

    const mnemonic = await decryptMnemonic(user.seedVault, null, request)
    wdk = createWdk(mnemonic, config.value)
    const account = await wdk.getAccount('evm', 0)
    const protocol = new VeloraProtocolEvm(account, { swapMaxFee: config.value.evmSwapMaxFee })

    if (mode === 'quote') {
      const quote = await protocol.quoteSwap(swap.options)
      const minimumReceived = applySlippage(quote.tokenOutAmount, swap.slippageBps)
      response.json({
        ok: true,
        provider: 'Velora',
        chain: 'evm',
        network: config.value.evmChainName,
        route: 'Velora aggregator',
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: quote.tokenInAmount.toString(),
        amountOut: quote.tokenOutAmount.toString(),
        minimumReceived: minimumReceived.toString(),
        slippageBps: swap.slippageBps,
        priceImpact: null,
        exchangeRate: null,
        fee: quote.fee.toString(),
        feeDisplay: formatBaseUnits(quote.fee, getChainSpecs(config.value).find((chain) => chain.id === 'evm')),
        approval: 'Velora swap may request an ERC-20 allowance when required. Review approval hashes after broadcast.'
      })
      return
    }

    const quote = await protocol.quoteSwap(swap.options)
    const result = await protocol.swap({
      ...swap.options,
      minAmountOut: applySlippage(quote.tokenOutAmount, swap.slippageBps)
    }, { swapMaxFee: config.value.evmSwapMaxFee })
    recordActivity(user.id, {
      type: 'swap',
      chain: 'evm',
      asset: `${swap.tokenIn} -> ${swap.tokenOut}`,
      amount: result.tokenInAmount?.toString?.() || swap.options.tokenInAmount.toString(),
      status: 'success',
      hash: result.hash,
      link: result.hash ? `${config.value.evmTxExplorer}${result.hash}` : null,
      approveHash: result.approveHash || null,
      resetAllowanceHash: result.resetAllowanceHash || null
    })
    response.json({
      ok: true,
      provider: 'Velora',
      hash: result.hash,
      link: result.hash ? `${config.value.evmTxExplorer}${result.hash}` : null,
      approveHash: result.approveHash || null,
      resetAllowanceHash: result.resetAllowanceHash || null,
      fee: result.fee?.toString?.() || null,
      tokenInAmount: result.tokenInAmount?.toString?.() || null,
      tokenOutAmount: result.tokenOutAmount?.toString?.() || null
    })
  } catch (error) {
    if (mode === 'send' && user?.id) {
      recordActivity(user.id, {
        type: 'swap',
        chain: 'evm',
        asset: `${request.body?.tokenIn || '?'} -> ${request.body?.tokenOut || '?'}`,
        amount: request.body?.amount || '',
        status: 'failed',
        hash: null,
        link: null,
        detail: friendlyError(error)
      })
    }
    response.status(400).json({
      ok: false,
      message: mode === 'quote' ? 'Could not quote this swap.' : 'Could not complete this swap.',
      action: 'Check token addresses, amount, liquidity, slippage, and the EVM provider.',
      detail: friendlyError(error)
    })
  } finally {
    wdk?.dispose()
  }
}

async function buildChainSummary(spec, account) {
  const address = await account.getAddress()
  const qr = await QRCode.toDataURL(address, {
    margin: 1,
    width: 168,
    color: { dark: '#050505', light: '#ffffff' }
  })

  try {
    const balance = await account.getBalance()
    return {
      ...publicChainSpec(spec),
      address,
      addressLink: buildAddressLink(spec, address),
      qr,
      balance: {
        ok: true,
        baseUnits: balance.toString(),
        units: spec.baseUnit,
        display: formatBaseUnits(balance, spec)
      }
    }
  } catch (error) {
    return {
      ...publicChainSpec(spec),
      address,
      addressLink: buildAddressLink(spec, address),
      qr,
      balance: {
        ok: false,
        baseUnits: null,
        units: spec.baseUnit,
        display: 'Unavailable',
        message: 'Balance request failed.',
        action: 'Refresh in a moment or check the configured network provider.',
        detail: friendlyError(error)
      }
    }
  }
}

function parseNativeTransaction({ chain, to, amount }, config) {
  const spec = getChainSpecs(config).find((item) => item.id === chain)
  if (!spec) {
    throw new PublicError('Choose Bitcoin, EVM, or Solana.', 'Select a supported chain before previewing the transaction.')
  }

  const recipient = requireText(to, 'Recipient address is required.')
  const normalizedAmount = requireText(amount, 'Amount is required.')

  validateAddress(chain, recipient)

  const value = parseDecimalAmount(normalizedAmount, spec.decimals, spec.symbol)
  if (value <= 0n) {
    throw new PublicError('Amount must be greater than zero.', 'Enter a positive amount before previewing the transaction.')
  }

  return { chain, to: recipient, amount: normalizedAmount, value, spec }
}

function parseSwapRequest(body) {
  const tokenIn = requireText(body.tokenIn, 'Token in is required.')
  const tokenOut = requireText(body.tokenOut, 'Token out is required.')
  const amount = requireText(body.amount, 'Swap amount is required.')

  if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
    throw new PublicError('Enter valid EVM token addresses.', 'Swaps are currently available for EVM ERC-20 tokens through Velora.')
  }

  const tokenInDecimals = readBoundedInteger(body.tokenInDecimals, 0, 36, 18)
  const slippageBps = readBoundedInteger(body.slippageBps, 1, 5000, 100)
  return {
    tokenIn,
    tokenOut,
    slippageBps,
    options: {
      tokenIn,
      tokenOut,
      tokenInAmount: parseDecimalAmount(amount, tokenInDecimals, 'token')
    }
  }
}

function validateAddress(chain, address) {
  if (chain === 'evm' && !isAddress(address)) {
    throw new PublicError('Enter a valid EVM address.', 'EVM addresses usually start with 0x.')
  }

  if (chain === 'bitcoin' && !isBitcoinAddress(address)) {
    throw new PublicError('Enter a valid Bitcoin address.', 'Use a valid mainnet or testnet Bitcoin address.')
  }

  if (chain === 'solana' && !isSolanaAddress(address)) {
    throw new PublicError('Enter a valid Solana address.', 'Solana addresses are base58 strings, usually 32 to 44 characters.')
  }
}

async function buildAssets(user, chains, config) {
  const nativeAssets = chains.map((chain) => ({
    id: `${chain.id}:native`,
    chain: chain.id,
    type: 'native',
    address: null,
    name: chain.name,
    symbol: chain.symbol,
    decimals: chain.decimals,
    balance: chain.balance,
    fiatValue: null,
    change24h: null
  }))

  const evmChain = chains.find((chain) => chain.id === 'evm')
  const tokens = await Promise.all((user.tokens || []).map(async (token) => {
    try {
      const balance = await fetchEvmTokenBalance(token, evmChain?.address, config.evmRpcUrl)
      return {
        ...token,
        type: 'token',
        balance: {
          ok: true,
          baseUnits: balance.toString(),
          units: token.symbol,
          display: `${trimTokenBalance(formatUnits(balance, token.decimals))} ${token.symbol}`
        },
        fiatValue: null,
        change24h: null
      }
    } catch (error) {
      return {
        ...token,
        type: 'token',
        balance: {
          ok: false,
          baseUnits: null,
          units: token.symbol,
          display: 'Unavailable',
          detail: friendlyError(error)
        },
        fiatValue: null,
        change24h: null
      }
    }
  }))

  return [...nativeAssets, ...tokens]
}

function buildPortfolio(assets) {
  const knownFiat = assets
    .map((asset) => asset.fiatValue)
    .filter((value) => typeof value === 'number')

  return {
    totalValue: knownFiat.length > 0 ? knownFiat.reduce((sum, value) => sum + value, 0) : null,
    currency: 'USD',
    pricedAssets: knownFiat.length,
    updatedAt: new Date().toISOString(),
    note: knownFiat.length === 0 ? 'Fiat pricing is not configured. Add a pricing provider to show total value and 24h change.' : null
  }
}

async function fetchEvmTokenMetadata(address, rpcUrl) {
  const token = new Contract(address, erc20Abi, new JsonRpcProvider(rpcUrl))
  const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()])
  return { name, symbol, decimals: Number(decimals) }
}

async function fetchEvmTokenBalance(token, owner, rpcUrl) {
  if (!owner) return 0n
  const contract = new Contract(token.address, erc20Abi, new JsonRpcProvider(rpcUrl))
  return contract.balanceOf(owner)
}

async function requirePasswordCheck(user, password) {
  const text = requireText(password, 'Password confirmation is required.')
  if (!(await verifyPassword(user, text))) {
    throw new PublicError('Password confirmation failed.', 'Re-enter your account password before continuing.')
  }
}

function normalizeMnemonic(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const mnemonic = value.trim().replace(/\s+/g, ' ')
  if (!WDK.isValidSeed(mnemonic)) {
    throw new PublicError('Imported seed phrase is invalid.', 'Check the words and spacing before importing.')
  }
  return mnemonic
}

function applySlippage(amount, slippageBps) {
  return amount - (amount * BigInt(slippageBps)) / 10000n
}

function recordActivity(userId, item) {
  const updated = updateUser(userId, (draft) => {
    draft.activity = [{
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...item
    }, ...(draft.activity || [])].slice(0, 100)
  })
  addNotification(updated.id, item.status === 'failed' ? 'error' : 'activity', `${item.type} ${item.status}`)
}

function addNotification(userId, type, message) {
  updateUser(userId, (draft) => {
    draft.notifications = [{
      id: crypto.randomUUID(),
      type,
      message,
      read: false,
      createdAt: new Date().toISOString()
    }, ...(draft.notifications || [])].slice(0, 100)
  })
}

function createWdk(mnemonic, config) {
  if (!WDK.isValidSeed(mnemonic)) {
    throw new Error('Stored recovery phrase is not a valid BIP-39 mnemonic.')
  }

  return new WDK(mnemonic)
    .registerWallet('bitcoin', WalletManagerBtc, {
      network: config.btcNetwork,
      bip: 84,
      client: {
        type: 'electrum',
        clientConfig: {
          host: config.btcElectrumHost,
          port: config.btcElectrumPort,
          protocol: config.btcElectrumProtocol
        }
      }
    })
    .registerWallet('evm', WalletManagerEvm, {
      provider: config.evmRpcUrl,
      chainId: config.evmChainId,
      transactionMaxFee: config.evmMaxFee,
      transferMaxFee: config.evmMaxFee
    })
    .registerWallet('solana', WalletManagerSolana, {
      provider: config.solanaRpcUrl,
      commitment: config.solanaCommitment,
      transactionMaxFee: config.solanaMaxFee,
      transferMaxFee: config.solanaMaxFee
    })
}

function readConfig() {
  const missing = []
  const evmRpcUrl = process.env.EVM_RPC_URL?.trim() || process.env.POLYGON_RPC_URL?.trim()
  if (!evmRpcUrl) missing.push('EVM_RPC_URL')
  const solanaRpcUrl = readRequired('SOLANA_RPC_URL', missing)
  const btcElectrumHost = readRequired('BTC_ELECTRUM_HOST', missing)

  if (missing.length > 0) return { ok: false, missing }

  return {
    ok: true,
    value: {
      evmRpcUrl,
      evmChainId: readInteger('EVM_CHAIN_ID', readInteger('POLYGON_CHAIN_ID', 80002)),
      evmChainName: process.env.EVM_CHAIN_NAME?.trim() || 'Polygon Amoy',
      evmNativeSymbol: process.env.EVM_NATIVE_SYMBOL?.trim() || 'POL',
      evmAddressExplorer: process.env.EVM_EXPLORER_ADDRESS?.trim() || 'https://amoy.polygonscan.com/address/',
      evmTxExplorer: process.env.EVM_EXPLORER_TX?.trim() || 'https://amoy.polygonscan.com/tx/',
      evmMaxFee: readBigInt('EVM_MAX_FEE_WEI', 100000000000000000n),
      evmSwapMaxFee: readBigInt('EVM_SWAP_MAX_FEE_WEI', 200000000000000n),
      btcNetwork: process.env.BTC_NETWORK?.trim() || 'testnet',
      btcElectrumHost,
      btcElectrumPort: readInteger('BTC_ELECTRUM_PORT', 53011),
      btcElectrumProtocol: process.env.BTC_ELECTRUM_PROTOCOL?.trim() || 'tcp',
      btcAddressExplorer: process.env.BTC_EXPLORER_ADDRESS?.trim() || 'https://mempool.space/testnet/address/',
      btcTxExplorer: process.env.BTC_EXPLORER_TX?.trim() || 'https://mempool.space/testnet/tx/',
      solanaRpcUrl,
      solanaCluster: process.env.SOLANA_CLUSTER?.trim() || 'devnet',
      solanaCommitment: process.env.SOLANA_COMMITMENT?.trim() || 'confirmed',
      solanaAddressExplorer: process.env.SOLANA_EXPLORER_ADDRESS?.trim() || 'https://explorer.solana.com/address/',
      solanaTxExplorer: process.env.SOLANA_EXPLORER_TX?.trim() || 'https://explorer.solana.com/tx/',
      solanaMaxFee: readBigInt('SOLANA_MAX_FEE_LAMPORTS', 10000000n)
    }
  }
}

function getChainSpecs(config) {
  const solanaSuffix = config.solanaCluster === 'mainnet-beta' ? '' : `?cluster=${encodeURIComponent(config.solanaCluster)}`

  return [
    {
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      networkLabel: config.btcNetwork,
      accent: '#f5f5f5',
      decimals: 8,
      baseUnit: 'satoshis',
      addressExplorer: config.btcAddressExplorer,
      txExplorer: config.btcTxExplorer
    },
    {
      id: 'evm',
      name: config.evmChainName,
      symbol: config.evmNativeSymbol,
      networkLabel: `chain ${config.evmChainId}`,
      accent: '#d8d8d8',
      decimals: 18,
      baseUnit: 'wei',
      addressExplorer: config.evmAddressExplorer,
      txExplorer: config.evmTxExplorer
    },
    {
      id: 'solana',
      name: 'Solana',
      symbol: 'SOL',
      networkLabel: config.solanaCluster,
      accent: '#ffffff',
      decimals: 9,
      baseUnit: 'lamports',
      addressExplorer: config.solanaAddressExplorer,
      explorerSuffix: solanaSuffix,
      txExplorer: config.solanaTxExplorer,
      txExplorerSuffix: solanaSuffix
    }
  ]
}

function publicChainSpec(spec) {
  return {
    id: spec.id,
    name: spec.name,
    symbol: spec.symbol,
    networkLabel: spec.networkLabel,
    accent: spec.accent,
    decimals: spec.decimals,
    baseUnit: spec.baseUnit,
    explorer: spec.addressExplorer
  }
}

function buildAddressLink(spec, address) {
  return `${spec.addressExplorer}${address}${spec.explorerSuffix || ''}`
}

function buildTxLink(spec, hash) {
  return `${spec.txExplorer}${hash}${spec.txExplorerSuffix || ''}`
}

function parseDecimalAmount(amount, decimals, symbol) {
  const normalized = amount.trim()
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`)
  if (!pattern.test(normalized)) {
    throw new PublicError(
      `Enter a valid ${symbol} amount.`,
      `${symbol} amounts can have up to ${decimals} decimal places.`
    )
  }

  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'))
}

function formatBaseUnits(value, spec) {
  const divisor = 10n ** BigInt(spec.decimals)
  const whole = value / divisor
  const fraction = (value % divisor).toString().padStart(spec.decimals, '0')
  const trimmed = fraction.replace(/0+$/, '')
  return `${whole}${trimmed ? `.${trimmed}` : '.0'} ${spec.symbol}`
}

function trimTokenBalance(value) {
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.0')
}

function isBitcoinAddress(address) {
  return /^(bc1|tb1|bcrt1|[13mn2])[a-zA-HJ-NP-Z0-9]{24,90}$/.test(address)
}

function isSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

function parseCredentials(body) {
  const username = requireText(body?.username, 'Username is required.')
  const password = requireText(body?.password, 'Password is required.')
  const issue = getCredentialValidationError(username, password)
  if (issue) throw new PublicError(issue.message, issue.action)

  return { username, password }
}

function requireText(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PublicError(message, 'Fill in the required field and try again.')
  }
  return value.trim()
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64)
}

async function deriveKey(password, salt) {
  return scrypt(password, salt, 32)
}

async function verifyPassword(user, password) {
  const expected = Buffer.from(user.passwordHash, 'base64')
  const actual = Buffer.from(await hashPassword(password, user.passwordSalt), 'base64')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

async function encryptMnemonic(mnemonic, password) {
  const salt = randomBase64(16)
  const iv = crypto.randomBytes(12)
  const key = Buffer.from(await deriveKey(password, salt), 'base64')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()])

  return {
    algorithm: 'aes-256-gcm',
    salt,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

async function decryptMnemonic(vault, password, request) {
  let keyBase64 = password ? await deriveKey(password, vault.salt) : null
  if (!keyBase64) {
    const session = sessions.get(getSessionId(request))
    keyBase64 = session?.unlockKey
  }

  if (!keyBase64) {
    throw new PublicError('Session expired.', 'Sign in again to unlock the wallet.')
  }

  const key = Buffer.from(keyBase64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(vault.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(vault.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(vault.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8')
}

function scrypt(secret, salt, keyLength) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(secret, salt, keyLength, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString('base64'))
    })
  })
}

function setSession(response, userId, unlockKey) {
  const sid = crypto.randomBytes(32).toString('base64url')
  sessions.set(sid, {
    userId,
    unlockKey,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8
  })

  response.cookie(cookieName, sid, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
    path: '/'
  })
}

function requireUser(request, response) {
  const sid = getSessionId(request)
  const session = sid ? sessions.get(sid) : null
  if (!session || session.expiresAt < Date.now()) {
    if (sid) sessions.delete(sid)
    response.status(401).json({
      ok: false,
      message: 'You need to sign in first.',
      action: 'Log in or create an account to access wallet features.'
    })
    return null
  }

  const user = readUserStore().users.find((item) => item.id === session.userId)
  if (!user) {
    sessions.delete(sid)
    response.status(401).json({
      ok: false,
      message: 'Account was not found.',
      action: 'Register a new account to continue.'
    })
    return null
  }

  return user
}

function getSessionId(request) {
  const cookies = Object.fromEntries(
    (request.headers.cookie || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=')
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))]
      })
  )
  return cookies[cookieName]
}

function clearSession(response) {
  response.cookie(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
}

function findUser(username) {
  return readUserStore().users.find((user) => user.username.toLowerCase() === username.toLowerCase())
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    backupConfirmed: Boolean(user.backupConfirmed),
    createdAt: user.createdAt
  }
}

function readUserStore() {
  ensureDataDir()
  if (!fs.existsSync(usersFile)) return { users: [] }
  const store = JSON.parse(fs.readFileSync(usersFile, 'utf8'))
  store.users = (store.users || []).map(normalizeStoredUser)
  return store
}

function writeUserStore(store) {
  ensureDataDir()
  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2))
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true })
}

function getUser(userId) {
  return normalizeStoredUser(readUserStore().users.find((user) => user.id === userId))
}

function updateUser(userId, updater) {
  const store = readUserStore()
  const index = store.users.findIndex((user) => user.id === userId)
  if (index === -1) throw new PublicError('Account was not found.', 'Sign in again to continue.')
  const draft = normalizeStoredUser(store.users[index])
  updater(draft)
  store.users[index] = draft
  writeUserStore(store)
  return draft
}

function normalizeStoredUser(user) {
  if (!user) return user
  return {
    ...user,
    tokens: user.tokens || [],
    contacts: user.contacts || [],
    activity: user.activity || [],
    notifications: user.notifications || [],
    backupConfirmed: Boolean(user.backupConfirmed)
  }
}

function readRequired(name, missing) {
  const value = process.env[name]?.trim()
  if (!value) missing.push(name)
  return value
}

function readInteger(name, fallback) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`)
  }
  return value
}

function readBoundedInteger(value, min, max, fallback) {
  const parsed = value === undefined || value === null || value === '' ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PublicError('Numeric value is out of range.', `Use an integer between ${min} and ${max}.`)
  }
  return parsed
}

function readBigInt(name, fallback) {
  const raw = process.env[name]?.trim()
  return raw ? BigInt(raw) : fallback
}

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString('base64')
}

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient funds|insufficient balance/i.test(message)) {
    return 'Insufficient balance for the amount plus network fee.'
  }
  if (/fetch failed|network|timeout|ENOTFOUND|ECONNREFUSED|provider/i.test(message)) {
    return 'Network provider request failed. Check the RPC or Electrum configuration.'
  }
  return message
}

function sendError(response, error, fallback) {
  const status = error instanceof PublicError ? 400 : 500
  response.status(status).json({
    ok: false,
    message: error instanceof PublicError ? error.message : fallback,
    action: error instanceof PublicError ? error.action : 'Try again or check the server configuration.',
    detail: error instanceof PublicError ? undefined : friendlyError(error)
  })
}

function loadLocalEnv() {
  const envPath = path.resolve('.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] ??= value
  }
}

class PublicError extends Error {
  constructor(message, action) {
    super(message)
    this.action = action
  }
}

export { app, port }
