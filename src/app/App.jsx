import React from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WalletCards
} from 'lucide-react'
import {
  getContactAddress,
  getContactMatch,
  getCredentialValidationError,
  getPasswordValidationError,
  getRegistrationValidationError,
  getUsernameValidationError
} from '../../shared/wallet-validation.js'

const logoSrc = '/mamba-logo.jpg'
const activityKey = 'mamba-wallet-activity'
const tabs = [
  { id: 'overview', label: 'Overview', icon: WalletCards },
  { id: 'receive', label: 'Receive', icon: QrCode },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'swap', label: 'Swap', icon: RefreshCw },
  { id: 'assets', label: 'Assets', icon: WalletCards },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'contacts', label: 'Contacts', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings }
]

function App() {
  const [auth, setAuth] = React.useState({ status: 'loading', user: null })

  const loadSession = React.useCallback(async () => {
    try {
      const data = await api('/api/auth/me')
      setAuth({ status: 'ready', user: data.user })
    } catch {
      setAuth({ status: 'signed-out', user: null })
    }
  }, [])

  React.useEffect(() => {
    loadSession()
  }, [loadSession])

  if (auth.status === 'loading') return <LoadingScreen />

  if (!auth.user) {
    return <AuthScreen onAuthenticated={(user) => setAuth({ status: 'ready', user })} />
  }

  return <WalletApp user={auth.user} onLogout={() => setAuth({ status: 'signed-out', user: null })} />
}

function WalletApp({ user, onLogout }) {
  const [wallet, setWallet] = React.useState(null)
  const [status, setStatus] = React.useState('loading')
  const [error, setError] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('overview')
  const [copied, setCopied] = React.useState(null)
  const [activityItems, setActivityItems] = React.useState(loadActivity)
  const [notifications, setNotifications] = React.useState([])
  const [balancesHidden, setBalancesHidden] = React.useState(false)

  const loadWallet = React.useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await api('/api/wallet')
      setWallet(data)
      setStatus('ready')
    } catch (requestError) {
      setWallet(null)
      setError(normalizeError(requestError))
      setStatus('error')
    }
  }, [])

  React.useEffect(() => {
    loadWallet()
  }, [loadWallet])

  const loadActivityCenter = React.useCallback(async () => {
    try {
      const [activity, notificationData] = await Promise.all([
        api('/api/activity'),
        api('/api/notifications')
      ])
      setActivityItems(activity.activity || [])
      setNotifications(notificationData.notifications || [])
    } catch {
      setActivityItems(loadActivity())
    }
  }, [])

  React.useEffect(() => {
    if (status === 'ready') loadActivityCenter()
  }, [status, loadActivityCenter])

  React.useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart']
    let timer = window.setTimeout(logout, 5 * 60 * 1000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(logout, 5 * 60 * 1000)
    }
    events.forEach((event) => window.addEventListener(event, reset))
    return () => {
      window.clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
  })

  const chains = wallet?.chains ?? []
  const readyChains = chains.filter((chain) => chain.balance.ok).length

  const copyAddress = async (chain) => {
    await navigator.clipboard.writeText(chain.address)
    setCopied(chain.id)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const recordActivity = (item) => {
    const next = [{ ...item, createdAt: new Date().toISOString() }, ...activityItems].slice(0, 16)
    setActivityItems(next)
    localStorage.setItem(activityKey, JSON.stringify(next))
    loadActivityCenter()
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src={logoSrc} alt="Mamba wallet logo" />
          <div>
            <strong>Mamba</strong>
            <span>WDK Wallet</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Wallet sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <UserRound aria-hidden="true" />
            <span>{user.username}</span>
          </div>
          <button className="quiet-button" onClick={logout}>
            <LogOut aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <section className="workspace">
        <Header
          user={user}
          readyChains={readyChains}
          totalChains={chains.length || 3}
          updatedAt={wallet?.generatedAt}
          onRefresh={loadWallet}
          loading={status === 'loading'}
          balancesHidden={balancesHidden}
          onTogglePrivacy={() => setBalancesHidden(!balancesHidden)}
        />

        {status === 'loading' ? <LoadingGrid /> : null}
        {status === 'error' && error ? <FailurePanel error={error} /> : null}

        {status === 'ready' && wallet ? (
          <>
            {activeTab === 'overview' ? (
              <Overview chains={chains} assets={wallet.assets || []} portfolio={wallet.portfolio} copied={copied} onCopy={copyAddress} onRefresh={loadWallet} balancesHidden={balancesHidden} />
            ) : null}
            {activeTab === 'receive' ? <ReceivePanel chains={chains} copied={copied} onCopy={copyAddress} /> : null}
            {activeTab === 'send' ? (
              <SendPanel chains={chains} onActivity={recordActivity} onRefresh={loadWallet} />
            ) : null}
            {activeTab === 'swap' ? <SwapPanel assets={wallet.assets || []} onActivity={recordActivity} onRefresh={loadWallet} /> : null}
            {activeTab === 'assets' ? <AssetsPanel assets={wallet.assets || []} onRefresh={loadWallet} balancesHidden={balancesHidden} /> : null}
            {activeTab === 'activity' ? <ActivityPanel items={activityItems} notifications={notifications} /> : null}
            {activeTab === 'contacts' ? <ContactsPanel chains={chains} /> : null}
            {activeTab === 'settings' ? <SettingsPanel user={user} /> : null}
          </>
        ) : null}
      </section>
    </main>
  )
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = React.useState('login')
  const [form, setForm] = React.useState({ username: '', password: '', confirmPassword: '' })
  const [importSeed, setImportSeed] = React.useState(false)
  const [mnemonic, setMnemonic] = React.useState('')
  const [status, setStatus] = React.useState('idle')
  const [error, setError] = React.useState(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [attempted, setAttempted] = React.useState(false)

  const usernameError = attempted ? getUsernameValidationError(form.username) : null
  const passwordError = attempted ? getPasswordValidationError(form.password) : null
  const confirmPasswordError = attempted && mode === 'register'
    ? getRegistrationValidationError(form)?.field === 'confirmPassword'
      ? getRegistrationValidationError(form)
      : null
    : null

  const submit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    if (mode === 'register') {
      const validationError = getRegistrationValidationError(form)
      if (validationError) {
        setError(validationError)
        return
      }
    } else {
      const validationError = getCredentialValidationError(form.username, form.password)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setStatus('submitting')
    setError(null)
    try {
      const data = await api(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          mnemonic: mode === 'register' && importSeed ? mnemonic : undefined
        })
      })
      onAuthenticated(data.user)
    } catch (requestError) {
      setError(normalizeError(requestError))
      setStatus('idle')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="logo-lockup centered">
          <img src={logoSrc} alt="Mamba wallet logo" />
          <span>Protected WDK Wallet</span>
        </div>
        <h1 id="auth-title">One wallet. Three networks. Quietly secure.</h1>
        <p>
          Create a local account to unlock Bitcoin, EVM, and Solana wallet controls backed by an
          encrypted server-side recovery phrase.
        </p>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); setAttempted(false) }} type="button">
            Login
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); setAttempted(false) }} type="button">
            Register
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Username
            <input
              autoComplete="username"
              aria-invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? 'username-error' : mode === 'register' ? 'username-hint' : undefined}
              value={form.username}
              onChange={(event) => { setForm({ ...form, username: event.target.value }); setError(null) }}
              placeholder="rauli"
            />
            {mode === 'register' ? <span className={usernameError ? 'field-hint field-error' : 'field-hint'} id={usernameError ? 'username-error' : 'username-hint'}>{usernameError?.message || '3-32 characters: letters, numbers, dots, dashes, or underscores.'}</span> : null}
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : mode === 'register' ? 'password-hint' : undefined}
                value={form.password}
                onChange={(event) => { setForm({ ...form, password: event.target.value }); setError(null) }}
                placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters'}
              />
              <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {mode === 'register' ? <span className={passwordError ? 'field-hint field-error' : 'field-hint'} id={passwordError ? 'password-error' : 'password-hint'}>{passwordError?.message || 'Use at least 10 characters.'}</span> : null}
          </label>
          {mode === 'register' ? (
            <label>
              Confirm password
              <div className="password-field">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={Boolean(confirmPasswordError)}
                  aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
                  value={form.confirmPassword}
                  onChange={(event) => { setForm({ ...form, confirmPassword: event.target.value }); setError(null) }}
                  placeholder="Enter your password again"
                />
                <button className="password-toggle" type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {confirmPasswordError ? <span className="field-hint field-error" id="confirm-password-error">{confirmPasswordError.message}</span> : null}
            </label>
          ) : null}
          {mode === 'register' ? (
            <label className="check-row">
              <input type="checkbox" checked={importSeed} onChange={(event) => setImportSeed(event.target.checked)} />
              Import an existing recovery phrase instead of creating a new wallet.
            </label>
          ) : null}
          {mode === 'register' && importSeed ? (
            <label>
              Recovery phrase
              <input
                value={mnemonic}
                onChange={(event) => setMnemonic(event.target.value)}
                placeholder="twelve or twenty four words"
              />
            </label>
          ) : null}
          <button className="primary-action full" disabled={status === 'submitting'}>
            {status === 'submitting' ? <Loader2 className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            {mode === 'login' ? 'Unlock wallet' : 'Create secure wallet'}
          </button>
        </form>

        {error ? <InlineMessage tone="danger" title={error.message} text={error.action || error.detail} /> : null}

        <div className="security-strip">
          <ShieldCheck aria-hidden="true" />
          <span>Seed phrases are encrypted on the server and never stored in the browser.</span>
        </div>
      </section>

      <section className="auth-visual" aria-hidden="true">
        <div className="orbital-card">
          <img src={logoSrc} alt="" />
          <span className="orbit one" />
          <span className="orbit two" />
          <span className="orbit three" />
          <b className="node btc">BTC</b>
          <b className="node evm">EVM</b>
          <b className="node sol">SOL</b>
        </div>
      </section>
    </main>
  )
}

function Header({ user, readyChains, totalChains, updatedAt, onRefresh, loading, balancesHidden, onTogglePrivacy }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Self-custody interface</p>
        <h2>Dashboard</h2>
        <span>Signed in as {user.username}</span>
      </div>
      <div className="topbar-actions">
        <Metric label="Networks" value={`${readyChains}/${totalChains}`} />
        <Metric label="Updated" value={updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} />
        <button className="secondary-action" onClick={onTogglePrivacy}>
          {balancesHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {balancesHidden ? 'Show' : 'Hide'}
        </button>
        <button className="secondary-action" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>
    </header>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Overview({ chains, assets, portfolio, copied, onCopy, onRefresh, balancesHidden }) {
  const totalReady = chains.filter((chain) => chain.balance.ok).length

  return (
    <section className="overview-stack">
      <div className="summary-band">
        <div>
          <p className="eyebrow">At a glance</p>
          <h3>{balancesHidden ? 'Hidden' : portfolio?.totalValue === null ? `${assets.length} assets tracked` : `$${portfolio.totalValue.toFixed(2)}`}</h3>
          <span>{portfolio?.note || `${totalReady} of ${chains.length} network balances ready.`}</span>
        </div>
        <button className="secondary-action" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" />
          Refresh balances
        </button>
      </div>

      <div className="wallet-grid" aria-label="Wallet overview">
        {chains.map((chain) => (
          <article className="chain-card" key={chain.id}>
            <div className="card-topline">
              <div>
                <span className="chain-glyph">{chain.symbol.slice(0, 1)}</span>
                <div>
                  <h3>{chain.name}</h3>
                  <p>{chain.networkLabel}</p>
                </div>
              </div>
              <span>{chain.symbol}</span>
            </div>

            <div className="balance-block">
              <span>Native balance</span>
              <strong className={chain.balance.ok ? '' : 'muted'}>{balancesHidden ? 'Hidden' : chain.balance.display}</strong>
              <small>{balancesHidden ? 'Privacy mode is on' : chain.balance.ok ? `${chain.balance.baseUnits} ${chain.balance.units}` : chain.balance.action}</small>
            </div>

            <div className="qr-address-layout">
              <div className="qr-box">
                <img src={chain.qr} alt={`${chain.name} address QR code`} />
              </div>
              <div className="address-panel">
                <span>Receive address</span>
                <code>{chain.address}</code>
                <div className="button-row">
                  <button className="icon-button" onClick={() => onCopy(chain)}>
                    {copied === chain.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied === chain.id ? 'Copied' : 'Copy'}
                  </button>
                  <a className="icon-link" href={chain.addressLink} target="_blank" rel="noreferrer">
                    <ArrowUpRight aria-hidden="true" />
                    Explorer
                  </a>
                </div>
              </div>
            </div>

            {!chain.balance.ok ? (
              <InlineMessage tone="danger" title={chain.balance.message} text={chain.balance.detail} />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function SendPanel({ chains, onActivity, onRefresh }) {
  const [chainId, setChainId] = React.useState('evm')
  const [recipient, setRecipient] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [feeSpeed, setFeeSpeed] = React.useState('normal')
  const [quote, setQuote] = React.useState(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [status, setStatus] = React.useState('idle')
  const [message, setMessage] = React.useState(null)
  const [contacts, setContacts] = React.useState([])
  const chain = chains.find((item) => item.id === chainId) ?? chains[0]
  const contactMatch = getContactMatch(contacts, chainId, recipient)
  const savedContact = contactMatch.status === 'saved' ? contactMatch.contact : null

  React.useEffect(() => {
    api('/api/address-book')
      .then((data) => setContacts(data.contacts || []))
      .catch(() => setContacts([]))
  }, [])

  const resetPreview = () => {
    setQuote(null)
    setConfirmed(false)
    setMessage(null)
  }

  const quoteTransaction = async (event) => {
    event.preventDefault()
    setStatus('quoting')
    setMessage(null)
    setQuote(null)
    setConfirmed(false)

    try {
      const data = await api('/api/quote', {
        method: 'POST',
        body: JSON.stringify({ chain: chainId, to: recipient, amount, feeSpeed })
      })
      setQuote(data)
      setStatus('quoted')
    } catch (requestError) {
      setStatus('idle')
      setMessage({ tone: 'danger', ...normalizeError(requestError) })
    }
  }

  const sendTransaction = async () => {
    setStatus('sending')
    setMessage(null)

    try {
      const data = await api('/api/send', {
        method: 'POST',
        body: JSON.stringify({ chain: chainId, to: recipient, amount, feeSpeed, password })
      })
      onActivity({
        chain: chainId,
        label: chain.name,
        hash: data.hash,
        link: data.link,
        amount,
        symbol: chain.symbol,
        recipient,
        feeDisplay: data.feeDisplay,
        status: 'submitted'
      })
      setMessage({
        tone: 'success',
        message: 'Transaction submitted.',
        action: data.hash,
        link: data.link
      })
      setQuote(null)
      setConfirmed(false)
      setRecipient('')
      setAmount('')
      setPassword('')
      setStatus('idle')
      onRefresh()
    } catch (requestError) {
      setStatus('quoted')
      setMessage({ tone: 'danger', ...normalizeError(requestError) })
    }
  }

  return (
    <section className="send-layout">
      <form className="panel-card" onSubmit={quoteTransaction}>
        <SectionTitle icon={Send} title="Send funds" text="Preview fee and total before anything is broadcast." />

        <label>
          Network
          <select value={chainId} onChange={(event) => { setChainId(event.target.value); resetPreview() }}>
            {chains.map((item) => (
              <option value={item.id} key={item.id}>{item.name} ({item.symbol})</option>
            ))}
          </select>
        </label>

        <label>
          Recipient
          <select
            aria-label="Choose a trusted recipient"
            value={savedContact?.id || ''}
            onChange={(event) => {
              setRecipient(getContactAddress(contacts, event.target.value))
              resetPreview()
            }}
          >
            <option value="">Type or choose below</option>
            {contacts.filter((contact) => contact.chain === chainId).map((contact) => (
              <option value={contact.id} key={contact.id}>{contact.name}</option>
            ))}
          </select>
          <input
            value={recipient}
            onChange={(event) => { setRecipient(event.target.value); resetPreview() }}
            placeholder={chainId === 'evm' ? '0x...' : chainId === 'bitcoin' ? 'tb1...' : 'Solana address'}
          />
        </label>
        {contactMatch.status === 'other-network' ? (
          <InlineMessage
            tone="danger"
            title="Saved on another network"
            text={`${contactMatch.contact.name} is saved for ${chains.find((item) => item.id === contactMatch.contact.chain)?.name || contactMatch.contact.chain}. Select that network or verify this recipient carefully.`}
          />
        ) : contactMatch.status === 'new' ? (
          <InlineMessage tone="danger" title="New address" text="This recipient is not in your trusted address book for this network." />
        ) : null}

        <label>
          Fee option
          <select value={feeSpeed} onChange={(event) => setFeeSpeed(event.target.value)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>

        <label>
          Amount
          <div className="amount-input">
            <input
              value={amount}
              onChange={(event) => { setAmount(event.target.value); resetPreview() }}
              placeholder="0.00"
              inputMode="decimal"
            />
            <span>{chain?.symbol}</span>
          </div>
        </label>

        <button className="primary-action full" disabled={status === 'quoting' || status === 'sending'}>
          {status === 'quoting' ? <Loader2 className="spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
          Preview transaction
        </button>
      </form>

      <aside className="panel-card review-card">
        <SectionTitle icon={ShieldAlert} title="Confirmation" text="Check every detail carefully before sending." />
        {quote ? (
          <div className="quote-box">
            <PreviewRow label="Network" value={`${quote.chainName} ${quote.network}`} />
            <PreviewRow label="Recipient" value={quote.to} code />
            <PreviewRow label="Amount" value={`${quote.amount} ${quote.symbol}`} />
            <PreviewRow label="Fee option" value={feeSpeed} />
            <PreviewRow label="Estimated fee" value={quote.feeDisplay} />
            <PreviewRow label="Total" value={quote.totalDisplay} />

            <label>
              Confirm password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <label className="check-row">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              I checked the recipient, fee, total, and network.
            </label>

            <button className="danger-action full" disabled={!confirmed || !password || status === 'sending'} onClick={sendTransaction}>
              {status === 'sending' ? <Loader2 className="spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
              Confirm and broadcast
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <QrCode aria-hidden="true" />
            <p>Fill the send form and preview the transaction to see fees, total, and network details.</p>
          </div>
        )}

        {message ? (
          <InlineMessage tone={message.tone} title={message.message} text={message.action || message.detail}>
            {message.link ? <a href={message.link} target="_blank" rel="noreferrer">Open transaction</a> : null}
          </InlineMessage>
        ) : null}
      </aside>
    </section>
  )
}

function ReceivePanel({ chains, copied, onCopy }) {
  const [chainId, setChainId] = React.useState(chains[0]?.id || 'bitcoin')
  const chain = chains.find((item) => item.id === chainId) || chains[0]

  if (!chain) return null

  return (
    <section className="panel-card receive-panel">
      <SectionTitle icon={QrCode} title="Receive" text="Choose the exact network before sharing an address." />
      <label>
        Network
        <select value={chainId} onChange={(event) => setChainId(event.target.value)}>
          {chains.map((item) => (
            <option value={item.id} key={item.id}>{item.name} ({item.symbol})</option>
          ))}
        </select>
      </label>
      <div className="receive-card">
        <div className="qr-box large">
          <img src={chain.qr} alt={`${chain.name} address QR code`} />
        </div>
        <div className="address-panel">
          <span>{chain.name} receive address</span>
          <code>{chain.address}</code>
          <div className="button-row">
            <button className="icon-button" onClick={() => onCopy(chain)}>
              {copied === chain.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied === chain.id ? 'Copied' : 'Copy'}
            </button>
            <a className="icon-link" href={chain.addressLink} target="_blank" rel="noreferrer">
              <ArrowUpRight aria-hidden="true" />
              Explorer
            </a>
          </div>
        </div>
      </div>
      <InlineMessage tone="danger" title="Network warning" text={`Only send ${chain.name} assets on ${chain.networkLabel}. Sending another network's assets here can permanently lose funds.`} />
    </section>
  )
}

function AssetsPanel({ assets, onRefresh, balancesHidden }) {
  const [query, setQuery] = React.useState('')
  const [tokenAddress, setTokenAddress] = React.useState('')
  const [message, setMessage] = React.useState(null)
  const [status, setStatus] = React.useState('idle')
  const filtered = assets.filter((asset) => `${asset.name} ${asset.symbol} ${asset.chain}`.toLowerCase().includes(query.toLowerCase()))

  const addToken = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage(null)
    try {
      const data = await api('/api/tokens', {
        method: 'POST',
        body: JSON.stringify({ address: tokenAddress })
      })
      setMessage({ tone: 'success', message: `${data.token.symbol} added.`, action: 'Refresh balances to see the token.' })
      setTokenAddress('')
      onRefresh()
    } catch (error) {
      setMessage({ tone: 'danger', ...normalizeError(error) })
    } finally {
      setStatus('idle')
    }
  }

  return (
    <section className="panel-card">
      <SectionTitle icon={WalletCards} title="Assets" text="Native coins and custom EVM tokens in one list." />
      <div className="toolbar-grid">
        <label>
          Search assets
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BTC, SOL, POL..." />
        </label>
        <form onSubmit={addToken} className="inline-form">
          <label>
            Add EVM token
            <input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} placeholder="0x token contract" />
          </label>
          <button className="secondary-action" disabled={status === 'loading'}>
            {status === 'loading' ? <Loader2 className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            Add
          </button>
        </form>
      </div>
      {message ? <InlineMessage tone={message.tone} title={message.message} text={message.action || message.detail} /> : null}
      <div className="asset-list">
        {filtered.length === 0 ? <div className="empty-state"><WalletCards /><p>No assets match your search.</p></div> : null}
        {filtered.map((asset) => (
          <article key={asset.id || `${asset.chain}-${asset.symbol}`}>
            <div>
              <strong>{asset.symbol}</strong>
              <span>{asset.name} · {asset.chain} · {asset.type}</span>
            </div>
            <div>
              <strong>{balancesHidden ? 'Hidden' : asset.balance?.display || 'Unavailable'}</strong>
              <span>{asset.fiatValue === null ? 'Fiat unavailable' : `$${asset.fiatValue.toFixed(2)}`}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function SwapPanel({ assets, onActivity, onRefresh }) {
  const evmTokens = assets.filter((asset) => asset.chain === 'evm')
  const customTokens = evmTokens.filter((asset) => asset.address)
  const [form, setForm] = React.useState({
    tokenIn: customTokens[0]?.address || '',
    tokenOut: customTokens[1]?.address || '',
    tokenInDecimals: customTokens[0]?.decimals || 18,
    amount: '',
    slippageBps: 100,
    password: ''
  })
  const [quote, setQuote] = React.useState(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [status, setStatus] = React.useState('idle')
  const [message, setMessage] = React.useState(null)

  const quoteSwap = async (event) => {
    event.preventDefault()
    setStatus('quoting')
    setMessage(null)
    setQuote(null)
    try {
      const data = await api('/api/swap/quote', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setQuote(data)
      setStatus('quoted')
    } catch (error) {
      setStatus('idle')
      setMessage({ tone: 'danger', ...normalizeError(error) })
    }
  }

  const sendSwap = async () => {
    setStatus('sending')
    setMessage(null)
    try {
      const data = await api('/api/swap/send', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setMessage({ tone: 'success', message: 'Swap submitted.', action: data.hash, link: data.link })
      setQuote(null)
      setConfirmed(false)
      onActivity({ type: 'swap', label: 'EVM swap', hash: data.hash, link: data.link, amount: form.amount, symbol: 'token' })
      onRefresh()
    } catch (error) {
      setMessage({ tone: 'danger', ...normalizeError(error) })
    } finally {
      setStatus('idle')
    }
  }

  return (
    <section className="send-layout">
      <form className="panel-card" onSubmit={quoteSwap}>
        <SectionTitle icon={RefreshCw} title="Swap" text="EVM ERC-20 swaps through the documented WDK Velora module." />
        <InlineMessage title="Provider" text="Swaps are EVM-only. Add token contracts in Assets, then quote before confirming." />
        <label>
          Token in
          <input value={form.tokenIn} onChange={(event) => setForm({ ...form, tokenIn: event.target.value })} placeholder="0x token to sell" />
        </label>
        <label>
          Token out
          <input value={form.tokenOut} onChange={(event) => setForm({ ...form, tokenOut: event.target.value })} placeholder="0x token to buy" />
        </label>
        <label>
          Amount
          <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" placeholder="0.00" />
        </label>
        <label>
          Token in decimals
          <input value={form.tokenInDecimals} onChange={(event) => setForm({ ...form, tokenInDecimals: event.target.value })} inputMode="numeric" />
        </label>
        <label>
          Slippage tolerance
          <select value={form.slippageBps} onChange={(event) => setForm({ ...form, slippageBps: Number(event.target.value) })}>
            <option value={50}>0.5%</option>
            <option value={100}>1%</option>
            <option value={300}>3%</option>
          </select>
        </label>
        <button className="primary-action full" disabled={status === 'quoting'}>
          {status === 'quoting' ? <Loader2 className="spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
          Quote swap
        </button>
      </form>

      <aside className="panel-card review-card">
        <SectionTitle icon={ShieldAlert} title="Swap review" text="Confirm route, minimum received, and approvals before broadcast." />
        {quote ? (
          <div className="quote-box">
            <PreviewRow label="Provider" value={quote.provider} />
            <PreviewRow label="Route" value={quote.route} />
            <PreviewRow label="Input amount" value={quote.amountIn} />
            <PreviewRow label="Expected output" value={quote.amountOut} />
            <PreviewRow label="Minimum received" value={quote.minimumReceived} />
            <PreviewRow label="Network fee" value={quote.feeDisplay} />
            <PreviewRow label="Price impact" value={quote.priceImpact ?? 'Not provided by quote'} />
            <InlineMessage title="Approval safety" text={quote.approval} />
            <label>
              Confirm password
              <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              I reviewed the route, slippage, minimum received, and approval risk.
            </label>
            <button className="danger-action full" disabled={!confirmed || !form.password || status === 'sending'} onClick={sendSwap}>
              {status === 'sending' ? <Loader2 className="spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
              Confirm swap
            </button>
          </div>
        ) : <div className="empty-state"><RefreshCw /><p>Quote an EVM token swap to see route, fees, slippage, and approval notes.</p></div>}
        {message ? (
          <InlineMessage tone={message.tone} title={message.message} text={message.action || message.detail}>
            {message.link ? <a href={message.link} target="_blank" rel="noreferrer">Open transaction</a> : null}
          </InlineMessage>
        ) : null}
      </aside>
    </section>
  )
}

function ContactsPanel({ chains }) {
  const [contacts, setContacts] = React.useState([])
  const [form, setForm] = React.useState({ name: '', chain: 'evm', address: '' })
  const [message, setMessage] = React.useState(null)

  const loadContacts = React.useCallback(async () => {
    try {
      const data = await api('/api/address-book')
      setContacts(data.contacts || [])
    } catch (error) {
      setMessage({ tone: 'danger', ...normalizeError(error) })
    }
  }, [])

  React.useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const saveContact = async (event) => {
    event.preventDefault()
    setMessage(null)
    try {
      await api('/api/address-book', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setForm({ name: '', chain: form.chain, address: '' })
      setMessage({ tone: 'success', message: 'Contact saved.', action: 'You can use this as a trusted address when sending.' })
      loadContacts()
    } catch (error) {
      setMessage({ tone: 'danger', ...normalizeError(error) })
    }
  }

  return (
    <section className="send-layout">
      <form className="panel-card" onSubmit={saveContact}>
        <SectionTitle icon={UserRound} title="Address book" text="Save trusted recipients and avoid retyping risky addresses." />
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Exchange, friend, cold wallet" />
        </label>
        <label>
          Network
          <select value={form.chain} onChange={(event) => setForm({ ...form, chain: event.target.value })}>
            {chains.map((chain) => <option key={chain.id} value={chain.id}>{chain.name}</option>)}
          </select>
        </label>
        <label>
          Address
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Trusted recipient address" />
        </label>
        <button className="primary-action full"><ArrowRight aria-hidden="true" />Save contact</button>
        {message ? <InlineMessage tone={message.tone} title={message.message} text={message.action || message.detail} /> : null}
      </form>
      <aside className="panel-card">
        <SectionTitle icon={ShieldCheck} title="Trusted addresses" text="The send screen warns when an address is not saved here." />
        <div className="activity-list">
          {contacts.length === 0 ? <div className="empty-state"><UserRound /><p>No trusted addresses saved yet.</p></div> : null}
          {contacts.map((contact) => (
            <article key={contact.id}>
              <div><strong>{contact.name}</strong><span>{contact.chain}</span></div>
              <code>{contact.address}</code>
            </article>
          ))}
        </div>
      </aside>
    </section>
  )
}

function ActivityPanel({ items, notifications }) {
  return (
    <section className="panel-card">
      <SectionTitle icon={Activity} title="Activity center" text="Sends, swaps, failures, contacts, and security events." />
      <div className="notification-strip">
        {(notifications || []).slice(0, 3).map((item) => (
          <span key={item.id}>{item.message}</span>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <WalletCards aria-hidden="true" />
          <p>No submitted activity yet.</p>
        </div>
      ) : (
        <div className="activity-list">
          {items.map((item) => (
            <article key={`${item.hash}-${item.createdAt}`}>
              <div>
                <strong>{item.type || item.label}</strong>
                <span>{item.chain} · {item.status || 'submitted'} · {new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <code>{item.hash || item.detail || item.to || 'No hash'}</code>
                {item.link ? <a href={item.link} target="_blank" rel="noreferrer">View transaction</a> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SettingsPanel({ user }) {
  const [password, setPassword] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [mnemonic, setMnemonic] = React.useState('')
  const [visible, setVisible] = React.useState(false)
  const [status, setStatus] = React.useState('idle')
  const [message, setMessage] = React.useState(null)
  const [backupConfirmed, setBackupConfirmed] = React.useState(Boolean(user.backupConfirmed))

  const revealSeed = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage(null)
    setMnemonic('')
    try {
      const data = await api('/api/profile/reveal-seed', {
        method: 'POST',
        body: JSON.stringify({ password, confirmation })
      })
      setMnemonic(data.mnemonic)
      setVisible(true)
      setStatus('idle')
    } catch (requestError) {
      setStatus('idle')
      setMessage(normalizeError(requestError))
    }
  }

  return (
    <section className="settings-grid">
      <article className="panel-card profile-card">
        <div className="logo-lockup">
          <img src={logoSrc} alt="Mamba wallet logo" />
          <div>
            <strong>{user.username}</strong>
            <span>Local protected account</span>
          </div>
        </div>
        <div className="settings-list">
          <p><Lock aria-hidden="true" /> Session cookie is HTTP-only and expires automatically.</p>
          <p><Fingerprint aria-hidden="true" /> Wallet seed is encrypted with your password.</p>
          <p><ShieldCheck aria-hidden="true" /> Normal wallet APIs never return the recovery phrase.</p>
        </div>
        {!backupConfirmed ? (
          <div>
            <InlineMessage tone="danger" title="Backup reminder" text="Reveal and store your recovery phrase somewhere safe before relying on this wallet." />
            <button
              className="secondary-action full"
              onClick={async () => {
                await api('/api/profile/backup-confirmed', { method: 'POST', body: JSON.stringify({}) })
                setBackupConfirmed(true)
              }}
            >
              <Check aria-hidden="true" />
              I backed up my phrase
            </button>
          </div>
        ) : <InlineMessage tone="success" title="Backup marked complete" text="You can still reveal the phrase after password re-authentication." />}
      </article>

      <article className="panel-card">
        <SectionTitle icon={KeyRound} title="Reveal recovery phrase" text="Only reveal it in private and never share it." />
        <InlineMessage tone="danger" title="High risk action" text="Anyone with this phrase can control all three wallets." />
        <form className="reveal-form" onSubmit={revealSeed}>
          <label>
            Re-enter password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            Type REVEAL_SEED
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="REVEAL_SEED"
            />
          </label>
          <button className="danger-action full" disabled={status === 'loading'}>
            {status === 'loading' ? <Loader2 className="spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
            Reveal seed phrase
          </button>
        </form>

        {message ? <InlineMessage tone="danger" title={message.message} text={message.action || message.detail} /> : null}

        {mnemonic ? (
          <div className="seed-box">
            <div className="seed-toolbar">
              <span>Recovery phrase</span>
              <button className="quiet-button" onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {visible ? 'Hide' : 'Show'}
              </button>
            </div>
            <code>{visible ? mnemonic : mnemonic.split(' ').map(() => '....').join(' ')}</code>
          </div>
        ) : null}
      </article>
    </section>
  )
}

function SectionTitle({ icon: Icon, title, text }) {
  return (
    <div className="section-title">
      <Icon aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  )
}

function PreviewRow({ label, value, code }) {
  return (
    <p className="preview-row">
      <span>{label}</span>
      {code ? <code>{value}</code> : <strong>{value}</strong>}
    </p>
  )
}

function InlineMessage({ tone = 'neutral', title, text, children }) {
  return (
    <div className={`inline-message ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {tone === 'success' ? <Check aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
      <div>
        <strong>{title}</strong>
        {text ? <span>{text}</span> : null}
        {children}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <img src={logoSrc} alt="Mamba wallet logo" />
      <Loader2 className="spin" aria-hidden="true" />
      <span>Opening secure wallet</span>
    </main>
  )
}

function LoadingGrid() {
  return (
    <section className="wallet-grid" aria-label="Loading wallet overview">
      {[0, 1, 2].map((item) => (
        <article className="chain-card skeleton" key={item}>
          <span />
          <strong />
          <p />
          <p />
        </article>
      ))}
    </section>
  )
}

function FailurePanel({ error }) {
  return (
    <section className="failure-panel" role="alert">
      <AlertCircle aria-hidden="true" />
      <div>
        <h3>{error.message}</h3>
        <p>{error.action}</p>
        {Array.isArray(error.missing) && error.missing.length > 0 ? (
          <ul>
            {error.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
        {error.detail ? <small>{error.detail}</small> : null}
      </div>
    </section>
  )
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw data
  return data
}

function normalizeError(error) {
  if (error && typeof error === 'object') {
    return {
      message: error.message || 'Request failed.',
      action: error.action || 'Refresh the app or check the local server.',
      detail: error.detail,
      missing: error.missing
    }
  }

  return {
    message: 'Request failed.',
    action: 'Refresh the app or check that the local server is running.'
  }
}

function loadActivity() {
  try {
    return JSON.parse(localStorage.getItem(activityKey) || '[]')
  } catch {
    return []
  }
}

export default App
