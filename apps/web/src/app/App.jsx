import React from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Shield,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from 'lucide-react'
import {
  getContactAddress,
  getContactMatch,
  getCredentialValidationError,
  getPasswordValidationError,
  getRegistrationValidationError,
  getUsernameValidationError,
  getWalletAvatarImageValidationError,
  getWalletNameValidationError,
  walletAvatarPresets
} from '@mamba/api-contracts'
import MambaLogo from '../components/MambaLogo.jsx'
import PublicSite from '../site/Site.jsx'

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
const navGroups = [
  { label: 'Portfolio', ids: ['overview', 'assets'] },
  { label: 'Move funds', ids: ['send', 'receive', 'swap'] },
  { label: 'Review', ids: ['activity'] },
  { label: 'Manage', ids: ['contacts', 'settings'] }
]

function App() {
  const pathname = window.location.pathname
  if (pathname !== '/app' && !pathname.startsWith('/app/')) {
    return <PublicSite pathname={pathname} />
  }

  return <WalletRoute />
}

function WalletRoute() {
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
  const [walletProfiles, setWalletProfiles] = React.useState(user.walletProfiles || [])
  const [activeWalletId, setActiveWalletId] = React.useState(user.activeWalletId || user.walletProfiles?.[0]?.id || '')
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [status, setStatus] = React.useState('loading')
  const [error, setError] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('overview')
  const [copied, setCopied] = React.useState(null)
  const [activityItems, setActivityItems] = React.useState(() => loadActivity().filter((item) => item.walletId === activeWalletId))
  const [notifications, setNotifications] = React.useState([])
  const [balancesHidden, setBalancesHidden] = React.useState(false)
  const closeProfile = React.useCallback(() => setProfileOpen(false), [])

  const loadWallet = React.useCallback(async (walletId = activeWalletId) => {
    setStatus('loading')
    setError(null)
    try {
      const data = await api(`/api/wallet?walletId=${encodeURIComponent(walletId)}`)
      setWallet(data)
      setWalletProfiles(data.walletProfiles || [])
      setActiveWalletId(data.activeWalletId)
      setStatus('ready')
    } catch (requestError) {
      setWallet(null)
      setError(normalizeError(requestError))
      setStatus('error')
    }
  }, [activeWalletId])

  React.useEffect(() => {
    loadWallet()
  }, [])

  const loadActivityCenter = React.useCallback(async () => {
    try {
      const [activity, notificationData] = await Promise.all([
        api(`/api/activity?walletId=${encodeURIComponent(activeWalletId)}`),
        api('/api/notifications')
      ])
      setActivityItems(activity.activity || [])
      setNotifications(notificationData.notifications || [])
    } catch {
      setActivityItems(loadActivity().filter((item) => item.walletId === activeWalletId))
    }
  }, [activeWalletId])

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
  const activeWallet = walletProfiles.find((profile) => profile.id === activeWalletId) || null
  const readyChains = chains.filter((chain) => chain.balance.ok).length
  const currentTab = tabs.find((tab) => tab.id === activeTab)

  const copyAddress = async (chain) => {
    await navigator.clipboard.writeText(chain.address)
    setCopied(chain.id)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const recordActivity = (item) => {
    const currentWalletItems = activityItems.filter((entry) => entry.walletId === activeWalletId)
    const next = [{ ...item, walletId: activeWalletId, createdAt: new Date().toISOString() }, ...currentWalletItems].slice(0, 16)
    setActivityItems(next)
    localStorage.setItem(activityKey, JSON.stringify(next))
    loadActivityCenter()
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  const switchWallet = async (walletId) => {
    await api('/api/wallet-profiles/active', {
      method: 'POST',
      body: JSON.stringify({ walletId })
    })
    setActiveWalletId(walletId)
    setActivityItems([])
    setProfileOpen(false)
    await loadWallet(walletId)
  }

  const saveProfile = async (walletId, profile) => {
    const data = await api(`/api/wallet-profiles/${encodeURIComponent(walletId)}`, {
      method: 'PATCH',
      body: JSON.stringify(profile)
    })
    setWalletProfiles(data.user.walletProfiles || [])
    return data.user.walletProfiles?.find((profile) => profile.id === walletId) || data.wallet
  }

  const addWallet = async (payload) => {
    const data = await api('/api/wallet-profiles', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    setWalletProfiles(data.user.walletProfiles || [])
    setActiveWalletId(data.wallet.id)
    setActivityItems([])
    await loadWallet(data.wallet.id)
    return data.wallet
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-block" href="/" aria-label="MAMBA home">
          <MambaLogo alt="Mamba wallet logo" />
          <div>
            <strong>Mamba</strong>
            <span>WDK Wallet</span>
          </div>
        </a>

        <SidebarPortfolio
          portfolio={wallet?.portfolio}
          assets={wallet?.assets || []}
          hidden={balancesHidden}
          onToggle={() => setBalancesHidden((value) => !value)}
        />

        <div className="sidebar-account">
          <WalletIdentity
            profile={activeWallet}
            subtitle={user.username}
            compact
            onClick={() => setProfileOpen(true)}
          />
        </div>

        <nav className="nav-stack" aria-label="Wallet sections">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              <div className="nav-group-items">
                {group.ids.map((id) => {
                  const tab = tabs.find((item) => item.id === id)
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      className={activeTab === tab.id ? 'active' : ''}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon aria-hidden="true" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <nav className="sidebar-utilities" aria-label="Help and security">
          <a href="/trust"><ShieldCheck aria-hidden="true" />Security notes<ArrowUpRight aria-hidden="true" /></a>
          <a href="https://docs.wdk.tether.io/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />WDK documentation<ArrowUpRight aria-hidden="true" /></a>
        </nav>

        <div className="sidebar-footer">
          <button className="quiet-button" onClick={logout}>
            <LogOut aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <main className="workspace">
        <Header
          title={currentTab?.label || 'Overview'}
          readyChains={readyChains}
          totalChains={chains.length || 3}
          updatedAt={wallet?.generatedAt}
          onRefresh={loadWallet}
          loading={status === 'loading'}
        />

        {status === 'loading' ? <LoadingGrid /> : null}
        {status === 'error' && error ? <FailurePanel error={error} /> : null}

        {status === 'ready' && wallet ? (
          <div className="screen-content" key={`${activeTab}:${activeWalletId}`}>
            {activeTab === 'overview' ? (
              <Overview chains={chains} portfolio={wallet.portfolio} copied={copied} onCopy={copyAddress} onNavigate={setActiveTab} balancesHidden={balancesHidden} />
            ) : null}
            {activeTab === 'receive' ? <ReceivePanel chains={chains} walletProfile={activeWallet} copied={copied} onCopy={copyAddress} /> : null}
            {activeTab === 'send' ? (
              <SendPanel chains={chains} walletProfile={activeWallet} onActivity={recordActivity} onRefresh={loadWallet} />
            ) : null}
            {activeTab === 'swap' ? <SwapPanel assets={wallet.assets || []} walletProfile={activeWallet} onActivity={recordActivity} onRefresh={loadWallet} /> : null}
            {activeTab === 'assets' ? <AssetsPanel assets={wallet.assets || []} onRefresh={loadWallet} balancesHidden={balancesHidden} /> : null}
            {activeTab === 'activity' ? <ActivityPanel items={activityItems} notifications={notifications} /> : null}
            {activeTab === 'contacts' ? <ContactsPanel chains={chains} /> : null}
            {activeTab === 'settings' ? <SettingsPanel user={user} walletProfile={activeWallet} onBackupConfirmed={(profile) => setWalletProfiles((items) => items.map((item) => item.id === profile.id ? profile : item))} /> : null}
          </div>
        ) : null}

        <details className="context-collapsible">
          <summary><span>Wallet context</span><small>{readyChains}/{chains.length || 3} networks ready</small></summary>
          <ContextPanel activeTab={activeTab} chains={chains} activityItems={activityItems} portfolio={wallet?.portfolio} onNavigate={setActiveTab} />
        </details>
      </main>

      <aside className="context-rail" aria-label="Wallet context">
        <ContextPanel activeTab={activeTab} chains={chains} activityItems={activityItems} portfolio={wallet?.portfolio} onNavigate={setActiveTab} />
      </aside>

      {profileOpen ? (
        <WalletProfilePanel
          activeWallet={activeWallet}
          profiles={walletProfiles}
          chains={chains}
          loading={status === 'loading'}
          onClose={closeProfile}
          onSwitch={switchWallet}
          onSaveProfile={saveProfile}
          onAddWallet={addWallet}
        />
      ) : null}
    </div>
  )
}

function WalletProfilePanel({ activeWallet, profiles, chains, loading, onClose, onSwitch, onSaveProfile, onAddWallet }) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(activeWallet?.name || '')
  const [avatarPreset, setAvatarPreset] = React.useState(activeWallet?.avatarPreset || 'mamba')
  const [avatarImage, setAvatarImage] = React.useState(activeWallet?.avatarImage || null)
  const [cropSource, setCropSource] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [notice, setNotice] = React.useState('')
  const [addMode, setAddMode] = React.useState(null)
  const [addForm, setAddForm] = React.useState({ name: '', password: '', mnemonic: '' })
  const [addError, setAddError] = React.useState(null)
  const [addStatus, setAddStatus] = React.useState('idle')
  const fileRef = React.useRef(null)
  const closeRef = React.useRef(null)
  const panelRef = React.useRef(null)
  const onCloseRef = React.useRef(onClose)
  const cropSourceRef = React.useRef(cropSource)

  React.useEffect(() => {
    onCloseRef.current = onClose
    cropSourceRef.current = cropSource
  }, [onClose, cropSource])

  React.useEffect(() => {
    const previousFocus = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (cropSourceRef.current) setCropSource('')
        else onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const topDialog = cropSourceRef.current
        ? document.querySelector('.avatar-crop-dialog')
        : panelRef.current
      const focusable = topDialog ? [...topDialog.querySelectorAll('button:not(:disabled), input:not([type="file"]):not(:disabled), textarea:not(:disabled), [href]')] : []
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  React.useEffect(() => {
    setName(activeWallet?.name || '')
    setAvatarPreset(activeWallet?.avatarPreset || 'mamba')
    setAvatarImage(activeWallet?.avatarImage || null)
    setEditing(false)
    setError(null)
    setNotice('')
  }, [activeWallet?.id, activeWallet?.name, activeWallet?.avatarPreset, activeWallet?.avatarImage])

  if (!activeWallet) return null

  const cancelEdit = () => {
    setName(activeWallet.name)
    setAvatarPreset(activeWallet.avatarPreset || 'mamba')
    setAvatarImage(activeWallet.avatarImage || null)
    setEditing(false)
    setError(null)
  }

  const readImage = (file) => {
    setError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Choose an image smaller than 8 MB. It will be cropped and resized before saving.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropSource(String(reader.result || ''))
    reader.onerror = () => setError('This image could not be opened. Try another file.')
    reader.readAsDataURL(file)
  }

  const saveChanges = async () => {
    const nameError = getWalletNameValidationError(name)
    const imageError = getWalletAvatarImageValidationError(avatarImage)
    if (nameError || imageError) {
      setError(nameError?.message || imageError?.message)
      return
    }
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      await onSaveProfile(activeWallet.id, { name: name.trim(), avatarPreset: avatarImage ? null : avatarPreset, avatarImage })
      setEditing(false)
      setNotice('Wallet profile saved.')
    } catch (requestError) {
      setError(normalizeError(requestError).message)
    } finally {
      setBusy(false)
    }
  }

  const submitNewWallet = async (event) => {
    event.preventDefault()
    const nameError = getWalletNameValidationError(addForm.name)
    if (nameError) return setAddError(nameError.message)
    if (!addForm.password) return setAddError('Enter your account password to add a wallet.')
    if (profiles.some((profile) => profile.name.toLowerCase() === addForm.name.trim().toLowerCase())) return setAddError('That wallet name is already in use.')
    if (addMode === 'import' && !addForm.mnemonic.trim()) return setAddError('Enter the recovery phrase you want to import.')
    setAddStatus('loading')
    setAddError(null)
    try {
      await onAddWallet({ name: addForm.name.trim(), password: addForm.password, mnemonic: addMode === 'import' ? addForm.mnemonic : undefined })
      setAddForm({ name: '', password: '', mnemonic: '' })
      setAddMode(null)
    } catch (requestError) {
      setAddError(normalizeError(requestError).message)
    } finally {
      setAddStatus('idle')
    }
  }

  const copyAddress = async (chain) => {
    try {
      await navigator.clipboard.writeText(chain.address)
      setNotice(`${chain.name} address copied.`)
      setError(null)
    } catch {
      setError('Could not copy this address. Select and copy it manually.')
    }
  }

  return (
    <div className="wallet-profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={panelRef} className="wallet-profile-panel" role="dialog" aria-modal="true" aria-labelledby="wallet-profile-title">
        <header className="wallet-profile-heading">
          <div><p className="eyebrow">MAMBA / WALLET PROFILE</p><h2 id="wallet-profile-title">Your wallets</h2></div>
          <button ref={closeRef} className="icon-only-button" type="button" onClick={onClose} aria-label="Close wallet profiles"><X aria-hidden="true" /></button>
        </header>

        {addMode ? (
          <form className="wallet-add-form" onSubmit={submitNewWallet}>
            <div className="wallet-panel-backline"><button type="button" className="quiet-button" onClick={() => { setAddMode(null); setAddError(null) }}><ArrowRight aria-hidden="true" /> Back to wallets</button><span>{addMode === 'create' ? 'New wallet' : 'Import wallet'}</span></div>
            <div className="mode-switch" role="tablist" aria-label="Wallet setup type">
              <button type="button" role="tab" aria-selected={addMode === 'create'} className={addMode === 'create' ? 'active' : ''} onClick={() => { setAddMode('create'); setAddError(null) }}>Create new</button>
              <button type="button" role="tab" aria-selected={addMode === 'import'} className={addMode === 'import' ? 'active' : ''} onClick={() => { setAddMode('import'); setAddError(null) }}>Import phrase</button>
            </div>
            <label>Wallet name<input autoFocus maxLength={32} value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} placeholder="e.g. Savings" /></label>
            {addMode === 'import' ? <label>Recovery phrase<textarea rows="3" autoComplete="off" spellCheck="false" value={addForm.mnemonic} onChange={(event) => setAddForm({ ...addForm, mnemonic: event.target.value })} placeholder="Enter your 12 or 24 words" /></label> : <InlineMessage title="Recovery phrase stays private" text="A new phrase is generated and encrypted on the server. Back it up from Settings before using the wallet." />}
            <label>Re-enter account password<input type="password" autoComplete="current-password" value={addForm.password} onChange={(event) => setAddForm({ ...addForm, password: event.target.value })} /></label>
            {addError ? <InlineMessage tone="danger" title={addError} /> : null}
            <button className="primary-action full" disabled={addStatus === 'loading'}>{addStatus === 'loading' ? <Loader2 className="spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}{addMode === 'create' ? 'Create wallet' : 'Import wallet'}</button>
          </form>
        ) : (
          <>
            <div className="wallet-profile-current">
              <WalletAvatar profile={activeWallet} />
              <div className="wallet-profile-current-copy"><span>ACTIVE WALLET</span><strong>{activeWallet.name}</strong><small>{profiles.length} {profiles.length === 1 ? 'wallet' : 'wallets'} in this account</small></div>
              {!editing ? <button className="secondary-action" type="button" onClick={() => { setEditing(true); setError(null); setNotice('') }}><Pencil aria-hidden="true" /> Edit profile</button> : null}
            </div>

            {editing ? (
              <div className="wallet-profile-editor">
                <label>Display name<input autoFocus maxLength={32} value={name} onChange={(event) => setName(event.target.value)} aria-describedby="wallet-name-hint" /><small id="wallet-name-hint">1-32 characters. Names are profile labels only.</small></label>
                <div className="wallet-avatar-editor"><span className="wallet-field-label">Profile image</span>
                  <div className="wallet-avatar-presets" role="group" aria-label="Choose a MAMBA-style avatar">
                    {walletAvatarPresets.map((preset) => <button key={preset} type="button" className={avatarPreset === preset && !avatarImage ? 'selected' : ''} aria-label={`Use ${preset} avatar`} aria-pressed={avatarPreset === preset && !avatarImage} onClick={() => { setAvatarPreset(preset); setAvatarImage(null) }}><WalletAvatar profile={{ avatarPreset }} small /></button>)}
                    <button type="button" className="wallet-upload-button" onClick={() => fileRef.current?.click()}><Camera aria-hidden="true" /><span>Upload</span></button>
                    <input ref={fileRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { readImage(event.target.files?.[0]); event.target.value = '' }} />
                  </div>
                  {avatarImage ? <div className="wallet-photo-actions"><WalletAvatar profile={{ avatarImage }} /><span>Custom photo</span><button type="button" className="quiet-button" onClick={() => { setAvatarImage(null); setAvatarPreset('mamba') }}>Remove photo</button></div> : null}
                </div>
                {error ? <InlineMessage tone="danger" title={error} /> : null}
                <div className="wallet-profile-edit-actions"><button type="button" className="secondary-action" onClick={cancelEdit} disabled={busy}>Cancel</button><button type="button" className="primary-action" onClick={saveChanges} disabled={busy}>{busy ? <Loader2 className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Save changes</button></div>
              </div>
            ) : null}

            {notice ? <InlineMessage tone="success" title={notice} /> : null}
            {error && !editing ? <InlineMessage tone="danger" title={error} /> : null}

            <section className="wallet-profile-section" aria-labelledby="wallet-addresses-title">
              <div className="wallet-profile-section-heading"><h3 id="wallet-addresses-title">Wallet addresses</h3><span>Chain specific</span></div>
              {loading ? <div className="wallet-profile-loading"><Loader2 className="spin" aria-hidden="true" /> Loading addresses</div> : chains.length ? <div className="wallet-profile-addresses">{chains.map((chain) => (
                <div className="wallet-profile-address" key={chain.id}><span className="wallet-chain-mark">{chain.symbol.slice(0, 1)}</span><span className="wallet-address-copy"><strong>{chain.name}</strong><small>{chain.networkLabel}</small><code title={chain.address}>{chain.address}</code></span><button className="icon-only-button" type="button" onClick={() => copyAddress(chain)} aria-label={`Copy ${chain.name} address`} title={`Copy ${chain.name} address`}><Copy aria-hidden="true" /></button></div>
              ))}</div> : <p className="wallet-profile-empty">Address details will appear when wallet providers are available.</p>}
            </section>

            <section className="wallet-profile-section" aria-labelledby="wallet-list-title">
              <div className="wallet-profile-section-heading"><h3 id="wallet-list-title">Switch wallet</h3><span>{profiles.length}/20</span></div>
              <div className="wallet-profile-list">{profiles.map((profile) => <button key={profile.id} type="button" className={`wallet-profile-option${profile.id === activeWallet.id ? ' active' : ''}`} disabled={profile.id === activeWallet.id || loading || busy} onClick={async () => { setBusy(true); setError(null); try { await onSwitch(profile.id) } catch (requestError) { setError(normalizeError(requestError).message); setBusy(false) }} }>
                <WalletAvatar profile={profile} small /><span><strong>{profile.name}</strong><small>{profile.id === activeWallet.id ? 'Currently active' : 'Switch to this wallet'}</small></span>{profile.id === activeWallet.id ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              </button>)}</div>
              <button className="secondary-action full wallet-add-trigger" type="button" onClick={() => { setAddMode('create'); setAddError(null) }} disabled={profiles.length >= 20}><Plus aria-hidden="true" /> Add or import wallet</button>
            </section>
            <p className="wallet-profile-footnote"><Shield aria-hidden="true" /> Names and avatars are profile preferences. They never alter addresses, keys, balances, or transaction history.</p>
          </>
        )}
      </section>
      {cropSource ? <AvatarCropper source={cropSource} onCancel={() => setCropSource('')} onApply={(image) => { setAvatarImage(image); setCropSource(''); setNotice('Photo cropped. Save changes to apply it.') }} /> : null}
    </div>
  )
}

function AvatarCropper({ source, onCancel, onApply }) {
  const [zoom, setZoom] = React.useState(1)
  const [x, setX] = React.useState(50)
  const [y, setY] = React.useState(50)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const imageRef = React.useRef(null)
  const cancelRef = React.useRef(null)
  const image = imageRef.current
  const coverScale = image?.naturalWidth && image?.naturalHeight ? Math.max(256 / image.naturalWidth, 256 / image.naturalHeight) * zoom : zoom

  React.useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  const crop = async () => {
    if (!image?.naturalWidth) return
    setSaving(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const context = canvas.getContext('2d')
      const baseScale = Math.max(256 / image.naturalWidth, 256 / image.naturalHeight)
      const cropSize = 256 / (baseScale * zoom)
      context.drawImage(image, (image.naturalWidth - cropSize) * x / 100, (image.naturalHeight - cropSize) * y / 100, cropSize, cropSize, 0, 0, 256, 256)
      const encode = (sourceCanvas, type, quality) => new Promise((resolve) => sourceCanvas.toBlob(resolve, type, quality))
      let blob = await encode(canvas, 'image/webp', 0.8)
      if (!blob) throw new Error('This browser could not crop the image.')
      let dataUrl = await readBlob(blob)
      for (const size of [192, 128]) {
        if (dataUrl.length <= 140_000) break
        const compactCanvas = document.createElement('canvas')
        compactCanvas.width = size
        compactCanvas.height = size
        compactCanvas.getContext('2d').drawImage(canvas, 0, 0, size, size)
        blob = await encode(compactCanvas, 'image/webp', 0.76)
        if (!blob) blob = await encode(compactCanvas, 'image/jpeg', 0.62)
        if (!blob) throw new Error('This browser could not compress the cropped image.')
        dataUrl = await readBlob(blob)
      }
      if (dataUrl.length > 140_000) throw new Error('This photo could not be compressed enough. Choose a simpler image.')
      onApply(dataUrl)
    } catch (cropError) {
      setError(cropError.message || 'Could not crop this image.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="avatar-crop-backdrop"><section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
    <header><div><p className="eyebrow">PROFILE IMAGE</p><h3 id="avatar-crop-title">Crop photo</h3></div><button ref={cancelRef} className="icon-only-button" type="button" onClick={onCancel} aria-label="Cancel crop"><X aria-hidden="true" /></button></header>
    <img ref={imageRef} className="crop-source-image" src={source} alt="" onLoad={() => setReady(true)} onError={() => setError('This image could not be opened.')} />
    <div className="avatar-crop-preview" style={{ backgroundImage: `url("${source}")`, backgroundSize: image?.naturalWidth ? `${image.naturalWidth * coverScale}px ${image.naturalHeight * coverScale}px` : 'cover', backgroundPosition: `${x}% ${y}%` }} aria-label="Cropped profile image preview" />
    <label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
    <label>Horizontal position<input type="range" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
    <label>Vertical position<input type="range" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
    {error ? <InlineMessage tone="danger" title={error} /> : null}
    <div className="wallet-profile-edit-actions"><button type="button" className="secondary-action" onClick={onCancel}>Cancel</button><button type="button" className="primary-action" onClick={crop} disabled={!ready || saving}>{saving ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Apply crop</button></div>
  </section></div>
}

function readBlob(blob) {
  if (!blob) return Promise.reject(new Error('Could not encode this photo.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
        <a className="logo-lockup centered auth-home-link" href="/" aria-label="Return to MAMBA home">
          <MambaLogo alt="Mamba wallet logo" />
          <span>Protected WDK Wallet</span>
        </a>
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
          <MambaLogo />
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

function Header({ title, readyChains, totalChains, updatedAt, onRefresh, loading }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Wallet workspace</p>
        <h2>{title}</h2>
      </div>
      <div className="topbar-actions">
        <Metric label="Networks" value={`${readyChains}/${totalChains}`} />
        <Metric label="Updated" value={updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} />
        <button className="secondary-action" onClick={() => onRefresh()} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>
    </header>
  )
}

function WalletAvatar({ profile, small = false }) {
  const avatarClass = `wallet-avatar${small ? ' small' : ''}`
  if (profile?.avatarImage) {
    return <span className={avatarClass}><img src={profile.avatarImage} alt="" /></span>
  }
  if ((profile?.avatarPreset || 'mamba') === 'mamba') {
    return <span className={`${avatarClass} mamba`}><MambaLogo alt="" /></span>
  }
  const AvatarIcon = profile?.avatarPreset === 'orbit' ? CircleDot : profile?.avatarPreset === 'fang' ? Shield : UserRound
  return <span className={`${avatarClass} ${profile?.avatarPreset || 'mono'}`}><AvatarIcon aria-hidden="true" /></span>
}

function WalletIdentity({ profile, subtitle, compact = false, onClick }) {
  return (
    <button
      className={`wallet-identity${compact ? ' compact' : ''}`}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`Active wallet: ${profile?.name || 'Wallet'}. Open wallet profile and switcher.`}
    >
      <WalletAvatar profile={profile} small={compact} />
      <span className="wallet-identity-copy">
        {compact ? <small>ACTIVE WALLET</small> : null}
        <strong>{profile?.name || 'Wallet'}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
      <ChevronDown aria-hidden="true" />
    </button>
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

function SidebarPortfolio({ portfolio, assets, hidden, onToggle }) {
  const hasValue = typeof portfolio?.totalValue === 'number'
  const value = hidden ? '••••••' : hasValue
    ? formatPortfolioValue(portfolio)
    : 'Not priced'

  return (
    <section className="sidebar-portfolio" aria-label="Portfolio value">
      <div className="sidebar-portfolio-topline">
        <span>Portfolio value</span>
        <button
          className="sidebar-privacy-toggle"
          type="button"
          onClick={onToggle}
          aria-label={hidden ? 'Show balances' : 'Hide balances'}
          aria-pressed={hidden}
          title={hidden ? 'Show balances' : 'Hide balances'}
        >
          {hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </button>
      </div>
      <strong className="sidebar-portfolio-value">{value}</strong>
      <small>{!portfolio ? 'Wallet data unavailable' : hasValue ? `${portfolio.pricedAssets} assets with prices` : `${assets.length} assets · fiat prices unavailable`}</small>
    </section>
  )
}

function ContextPanel({ activeTab, chains, activityItems, portfolio, onNavigate }) {
  const context = {
    overview: {
      icon: WalletCards,
      title: 'Market data is not connected',
      text: portfolio?.note || 'Balances are shown in their native units. This project does not configure fiat pricing or historical performance.'
    },
    assets: {
      icon: WalletCards,
      title: 'Asset data, without estimates',
      text: 'Native and tracked EVM token balances come from configured providers. Fiat pricing and price history are not configured.'
    },
    send: {
      icon: Send,
      title: 'Pause at the review step',
      text: 'Confirm the selected network, full recipient address, amount, fee estimate, and total before entering your password and broadcasting.'
    },
    receive: {
      icon: QrCode,
      title: 'Match the network exactly',
      text: 'Share the address and QR code only with assets sent on the selected chain. Similar-looking addresses are not interchangeable across networks.'
    },
    swap: {
      icon: RefreshCw,
      title: 'EVM swaps only',
      text: 'Quotes use the configured WDK Velora integration. Review minimum received, slippage, network fee, and any allowance before confirming.'
    },
    activity: {
      icon: Activity,
      title: 'App-submitted activity',
      text: 'This list records wallet actions submitted through MAMBA. It is not a full on-chain history index.'
    },
    contacts: {
      icon: UserRound,
      title: 'Contacts are network-specific',
      text: 'A saved address is trusted only for the chain it was added to. Check the chain and address before sending.'
    },
    settings: {
      icon: ShieldCheck,
      title: 'Server-backed key handling',
      text: 'The recovery phrase is encrypted at rest and decrypted by the server in memory for WDK operations. Reveal it only after re-authentication, in private.'
    }
  }[activeTab]
  const ContextIcon = context.icon

  return (
    <div className="context-content">
      <div className="context-header">
        <p className="eyebrow">MAMBA / CONTEXT</p>
        <h3>At a glance</h3>
      </div>

      <section className="context-section" aria-label="Network readiness">
        <div className="context-section-heading"><h4>Configured networks</h4><span>{chains.filter((chain) => chain.balance.ok).length}/{chains.length || 3}</span></div>
        <div className="context-network-list">
          {chains.length ? chains.map((chain) => (
            <div className="context-network" key={chain.id}>
              <span className={`network-dot ${chain.balance.ok ? 'ready' : 'failed'}`} />
              <span className="context-network-copy"><strong>{chain.name}</strong><small>{chain.networkLabel}</small></span>
              <span className="network-state">{chain.balance.ok ? 'Ready' : 'Unavailable'}</span>
            </div>
          )) : <p className="context-empty">Network results appear after wallet data loads.</p>}
        </div>
      </section>

      <section className="context-guidance" aria-live="polite">
        <ContextIcon aria-hidden="true" />
        <p className="eyebrow">FOR THIS SCREEN</p>
        <h4>{context.title}</h4>
        <p>{context.text}</p>
      </section>

      <section className="context-activity">
        <div className="context-section-heading">
          <h4>Recent activity</h4>
          <button type="button" onClick={() => onNavigate('activity')} aria-label="Open all activity"><ArrowUpRight aria-hidden="true" /></button>
        </div>
        {activityItems.slice(0, 3).length ? activityItems.slice(0, 3).map((item) => (
          <div className="context-activity-item" key={`${item.hash || item.label}-${item.createdAt}`}>
            <span className="activity-marker"><Activity aria-hidden="true" /></span>
            <span><strong>{item.type || item.label || 'Wallet action'}</strong><small>{item.chain || 'Network'} · {item.status || 'submitted'}</small></span>
          </div>
        )) : <p className="context-empty">No submitted wallet actions yet.</p>}
        <button className="context-view-all" type="button" onClick={() => onNavigate('activity')}>View activity <ArrowRight aria-hidden="true" /></button>
      </section>

      <p className="context-footnote">Network details reflect the current server configuration. No global network switcher is available.</p>
    </div>
  )
}

function formatPortfolioValue(portfolio) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: portfolio.currency || 'USD',
      maximumFractionDigits: 2
    }).format(portfolio.totalValue)
  } catch {
    return `${portfolio.totalValue} ${portfolio.currency || 'USD'}`
  }
}

function Overview({ chains, portfolio, copied, onCopy, onNavigate, balancesHidden }) {
  const totalReady = chains.filter((chain) => chain.balance.ok).length
  const portfolioValue = typeof portfolio?.totalValue === 'number'
    ? formatPortfolioValue(portfolio)
    : 'Not priced'

  return (
    <section className="overview-stack">
      <header className="portfolio-hero">
        <div className="portfolio-lead">
          <p className="eyebrow">MAMBA / WALLET OVERVIEW</p>
          <div className="portfolio-value">
            <span>Portfolio value</span>
            <h3>{balancesHidden ? 'Hidden' : portfolioValue}</h3>
          </div>
          <p className="portfolio-note">{portfolio?.note || `${totalReady} of ${chains.length} network balances are ready.`}</p>
        </div>
        <nav className="overview-actions" aria-label="Wallet actions">
          <button className="primary-action" onClick={() => onNavigate('send')}>
            <Send aria-hidden="true" />
            Send
          </button>
          <button className="secondary-action" onClick={() => onNavigate('receive')}>
            <QrCode aria-hidden="true" />
            Receive
          </button>
          <button className="secondary-action" onClick={() => onNavigate('swap')}>
            <RefreshCw aria-hidden="true" />
            Swap
          </button>
        </nav>
      </header>

      <header className="wallet-section-heading">
        <div>
          <p className="eyebrow">ACCOUNTS</p>
          <h3>Your wallets</h3>
        </div>
        <span>{totalReady} of {chains.length} networks ready</span>
      </header>

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

function SendPanel({ chains, walletProfile, onActivity, onRefresh }) {
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
        body: JSON.stringify({ walletId: walletProfile?.id, chain: chainId, to: recipient, amount, feeSpeed })
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
        body: JSON.stringify({ walletId: walletProfile?.id, chain: chainId, to: recipient, amount, feeSpeed, password })
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
        <TransactionWalletTag profile={walletProfile} />

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

function ReceivePanel({ chains, walletProfile, copied, onCopy }) {
  const [chainId, setChainId] = React.useState(chains[0]?.id || 'bitcoin')
  const chain = chains.find((item) => item.id === chainId) || chains[0]

  if (!chain) return null

  return (
    <section className="panel-card receive-panel">
      <SectionTitle icon={QrCode} title="Receive" text="Choose the exact network before sharing an address." />
      <TransactionWalletTag profile={walletProfile} />
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

function TransactionWalletTag({ profile }) {
  return (
    <div className="transaction-wallet-tag">
      <WalletAvatar profile={profile} small />
      <span>Using <strong>{profile?.name || 'active wallet'}</strong></span>
    </div>
  )
}

function AssetsPanel({ assets, onRefresh, balancesHidden }) {
  const [query, setQuery] = React.useState('')
  const [chainFilter, setChainFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [tokenAddress, setTokenAddress] = React.useState('')
  const [message, setMessage] = React.useState(null)
  const [status, setStatus] = React.useState('idle')
  const filtered = assets.filter((asset) => {
    const matchesQuery = `${asset.name} ${asset.symbol} ${asset.chain} ${asset.address || ''}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (chainFilter === 'all' || asset.chain === chainFilter) && (typeFilter === 'all' || asset.type === typeFilter)
  })
  const availableChains = [...new Set(assets.map((asset) => asset.chain))]

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
      <div className="asset-toolbar">
        <label>
          Search assets
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, symbol, or contract" />
        </label>
        <label>
          Network
          <select value={chainFilter} onChange={(event) => setChainFilter(event.target.value)}>
            <option value="all">All networks</option>
            {availableChains.map((chain) => <option value={chain} key={chain}>{chain}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All assets</option>
            <option value="native">Native</option>
            <option value="token">Tokens</option>
          </select>
        </label>
      </div>
      <form onSubmit={addToken} className="inline-form asset-add-token">
        <label>
          Add EVM token contract
          <input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} placeholder="0x token contract address" />
        </label>
        <button className="secondary-action" disabled={status === 'loading'}>
          {status === 'loading' ? <Loader2 className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          Add token
        </button>
      </form>
      {message ? <InlineMessage tone={message.tone} title={message.message} text={message.action || message.detail} /> : null}
      <div className="asset-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <WalletCards aria-hidden="true" />
            <p>{assets.length ? 'No assets match these filters.' : 'Asset balances are not available yet.'}</p>
            {assets.length ? <button className="quiet-button" onClick={() => { setQuery(''); setChainFilter('all'); setTypeFilter('all') }}>Clear filters</button> : <button className="quiet-button" onClick={() => onRefresh()}>Refresh assets</button>}
          </div>
        ) : null}
        {filtered.map((asset) => (
          <details className="asset-row" key={asset.id || `${asset.chain}-${asset.symbol}`}>
            <summary>
              <span className="asset-identity"><span className="asset-symbol-mark">{asset.symbol.slice(0, 1)}</span><span><strong>{asset.symbol}</strong><small>{asset.name} · {asset.chain}</small></span></span>
              <span className="asset-row-balance"><strong>{balancesHidden ? 'Hidden' : asset.balance?.display || 'Unavailable'}</strong><small>{typeof asset.fiatValue === 'number' ? `$${asset.fiatValue.toFixed(2)}` : 'Price unavailable'}</small></span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="asset-detail-grid">
              <p>Network<strong>{asset.chain}</strong></p>
              <p>Asset type<strong>{asset.type === 'native' ? 'Native coin' : 'EVM token'}</strong></p>
              {Number.isInteger(asset.decimals) ? <p>Decimals<strong>{asset.decimals}</strong></p> : null}
              {asset.address ? <p className="asset-contract">Contract<strong><code>{asset.address}</code></strong></p> : null}
              <p>Market data<strong>{typeof asset.fiatValue === 'number' ? 'Available' : 'Not configured'}</strong></p>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function SwapPanel({ assets, walletProfile, onActivity, onRefresh }) {
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
        body: JSON.stringify({ ...form, walletId: walletProfile?.id })
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
        body: JSON.stringify({ ...form, walletId: walletProfile?.id })
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
        <TransactionWalletTag profile={walletProfile} />
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
  const [query, setQuery] = React.useState('')
  const [chainFilter, setChainFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const chainNames = { bitcoin: 'Bitcoin', evm: 'EVM', solana: 'Solana' }
  const activityType = (item) => item.type || (item.recipient || item.to ? 'send' : item.label || 'activity')
  const filtered = items.filter((item) => {
    const searchable = `${activityType(item)} ${item.asset || ''} ${item.chain || ''} ${item.to || item.recipient || ''} ${item.hash || ''}`.toLowerCase()
    return searchable.includes(query.toLowerCase()) && (chainFilter === 'all' || item.chain === chainFilter) && (typeFilter === 'all' || activityType(item) === typeFilter)
  })
  const chains = [...new Set(items.map((item) => item.chain).filter(Boolean))]
  const types = [...new Set(items.map(activityType))]

  return (
    <section className="panel-card">
      <SectionTitle icon={Activity} title="Activity" text="Review sends and swaps submitted through this wallet." />
      <div className="activity-filters">
        <label>
          Search activity
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset, address, or hash" />
        </label>
        <label>
          Network
          <select value={chainFilter} onChange={(event) => setChainFilter(event.target.value)}>
            <option value="all">All networks</option>
            {chains.map((chain) => <option value={chain} key={chain}>{chainNames[chain] || chain}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All activity</option>
            {types.map((type) => <option value={type} key={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
          </select>
        </label>
      </div>
      <div className="notification-strip">
        {(notifications || []).slice(0, 3).map((item) => (
          <span key={item.id}>{item.message}</span>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <WalletCards aria-hidden="true" />
          <p>{items.length ? 'No activity matches these filters.' : 'No submitted wallet activity yet.'}</p>
          {items.length ? <button className="quiet-button" onClick={() => { setQuery(''); setChainFilter('all'); setTypeFilter('all') }}>Clear filters</button> : <p>Only actions submitted through MAMBA are recorded here; chain history is not indexed.</p>}
        </div>
      ) : (
        <div className="activity-list">
          {filtered.map((item) => {
            const type = activityType(item)
            const status = item.status || 'submitted'
            return (
              <details className="activity-entry" key={`${item.id || item.hash || item.label}-${item.createdAt}`}>
                <summary>
                  <span className="activity-marker"><Activity aria-hidden="true" /></span>
                  <span className="activity-entry-main"><strong>{type[0].toUpperCase() + type.slice(1)}</strong><small>{chainNames[item.chain] || item.label || item.chain || 'Network'} · {formatActivityDate(item.createdAt)}</small></span>
                  <span className="activity-entry-amount">{item.amount ? `${item.amount} ${item.asset || ''}` : item.asset || 'Wallet action'}</span>
                  <span className={`status-chip ${status}`}>{status}</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div className="activity-detail-grid">
                  <p>Status<strong>{status}</strong></p>
                  <p>Network<strong>{chainNames[item.chain] || item.chain || 'Unavailable'}</strong></p>
                  {item.asset ? <p>Asset<strong>{item.asset}</strong></p> : null}
                  {item.amount ? <p>Amount<strong>{item.amount}</strong></p> : null}
                  {item.to || item.recipient ? <p className="activity-recipient">Recipient<strong><code>{item.to || item.recipient}</code></strong></p> : null}
                  {item.hash ? <p className="activity-hash">Transaction hash<strong><code>{item.hash}</code></strong></p> : null}
                  {item.detail ? <p className="activity-error">Details<strong>{item.detail}</strong></p> : null}
                  {item.approveHash ? <p className="activity-hash">Approval hash<strong><code>{item.approveHash}</code></strong></p> : null}
                  {item.resetAllowanceHash ? <p className="activity-hash">Allowance reset hash<strong><code>{item.resetAllowanceHash}</code></strong></p> : null}
                  {item.link ? <a className="activity-explorer" href={item.link} target="_blank" rel="noreferrer">Open configured explorer <ArrowUpRight aria-hidden="true" /></a> : null}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}

function formatActivityDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function SettingsPanel({ user, walletProfile, onBackupConfirmed }) {
  const [password, setPassword] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [mnemonic, setMnemonic] = React.useState('')
  const [visible, setVisible] = React.useState(false)
  const [status, setStatus] = React.useState('idle')
  const [backupStatus, setBackupStatus] = React.useState('idle')
  const [message, setMessage] = React.useState(null)
  const [backupConfirmed, setBackupConfirmed] = React.useState(Boolean(walletProfile?.backupConfirmed))

  const revealSeed = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage(null)
    setMnemonic('')
    try {
      const data = await api('/api/profile/reveal-seed', {
        method: 'POST',
        body: JSON.stringify({ password, confirmation, walletId: walletProfile?.id })
      })
      setMnemonic(data.mnemonic)
      setVisible(true)
      setStatus('idle')
    } catch (requestError) {
      setStatus('idle')
      setMessage(normalizeError(requestError))
    }
  }

  const confirmBackup = async () => {
    setBackupStatus('loading')
    setMessage(null)
    try {
      const data = await api('/api/profile/backup-confirmed', { method: 'POST', body: JSON.stringify({ walletId: walletProfile?.id }) })
      setBackupConfirmed(true)
      onBackupConfirmed(data.wallet)
    } catch (requestError) {
      setMessage(normalizeError(requestError))
    } finally {
      setBackupStatus('idle')
    }
  }

  return (
    <section className="settings-grid">
      <article className="panel-card profile-card">
        <div className="logo-lockup">
          <WalletAvatar profile={walletProfile} />
          <div>
            <strong>{walletProfile?.name || user.username}</strong>
            <span>Wallet profile · {user.username}</span>
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
              disabled={backupStatus === 'loading'}
              onClick={confirmBackup}
            >
              {backupStatus === 'loading' ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
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
      <MambaLogo alt="Mamba wallet logo" />
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
