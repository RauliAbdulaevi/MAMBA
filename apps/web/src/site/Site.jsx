import React from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Code2,
  ExternalLink,
  FileClock,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards
} from 'lucide-react'
import MambaLogo from '../components/MambaLogo.jsx'
import './site.css'

const features = [
  {
    path: '/features/multichain',
    label: 'Multichain wallet',
    title: 'Three networks. One clear view.',
    description: 'View Bitcoin, Polygon EVM, and Solana accounts from one MAMBA wallet.',
    icon: WalletCards,
    preview: 'overview',
    points: [
      'Generate an address for each supported wallet manager.',
      'See each native balance and network label together.',
      'Copy receive addresses or open their configured explorer.'
    ],
    steps: ['Create an account or import a valid recovery phrase.', 'Open the overview to load addresses and network balances.', 'Choose a chain before receiving or sending.'],
    note: 'The current defaults are Bitcoin testnet, Polygon Amoy, and Solana devnet. Change provider configuration only when you understand the network.'
  },
  {
    path: '/features/send-receive',
    label: 'Send and receive',
    title: 'Move funds with the details in view.',
    description: 'Use chain-specific addresses, QR codes, transaction previews, and an explicit final confirmation.',
    icon: Send,
    preview: 'send',
    points: [
      'Receive with a QR code and an address for the selected network.',
      'Send native BTC, EVM native coin, or SOL with a fee quote first.',
      'Review network, recipient, amount, estimated fee, and total before sending.'
    ],
    steps: ['Select the network and enter or choose a recipient.', 'Enter the amount and request a transaction preview.', 'Check every detail, re-enter your password, then confirm.'],
    note: 'A transaction preview is an estimate. Network conditions may change before broadcast; blockchain transfers are generally irreversible.'
  },
  {
    path: '/features/swaps',
    label: 'Token swaps',
    title: 'See a swap quote before you commit.',
    description: 'Request EVM token swap quotes through the WDK Velora protocol integration and review its route and limits.',
    icon: RefreshCw,
    preview: 'swap',
    points: [
      'EVM ERC-20 swaps are routed through the configured Velora WDK module.',
      'Review expected output, minimum received, fee, route, and price impact when supplied.',
      'Confirm with your password only after reviewing the quote and approval note.'
    ],
    steps: ['Add or select supported EVM tokens.', 'Request a quote and review slippage-sensitive details.', 'Confirm the swap to request broadcast from the server.'],
    note: 'Swaps are EVM-only in the current app. Quotes can expire or change, and token approvals or protocol behavior can introduce additional risk.'
  },
  {
    path: '/features/portfolio',
    label: 'Portfolio and assets',
    title: 'Know what is held, and where.',
    description: 'See native balances across supported networks and track custom ERC-20 tokens on the configured EVM network.',
    icon: WalletCards,
    preview: 'assets',
    points: [
      'View native balances with chain-appropriate units.',
      'Add a custom EVM token by contract address and inspect its metadata and balance.',
      'Hide balances in the wallet interface when you need privacy.'
    ],
    steps: ['Refresh the wallet to fetch current provider data.', 'Open Assets to search or add an EVM token.', 'Check the selected network and contract before relying on token metadata.'],
    note: 'Fiat pricing and 24-hour portfolio change are not configured in this project, so the site does not display estimated dollar totals.'
  },
  {
    path: '/features/activity',
    label: 'Activity',
    title: 'A useful record of wallet actions.',
    description: 'Review actions submitted through the app, including their available status and explorer link.',
    icon: Activity,
    preview: 'activity',
    points: [
      'Find app-submitted sends and swaps in the activity center.',
      'Open the transaction explorer link when one is available.',
      'Receive notifications for supported in-app events.'
    ],
    steps: ['Submit a supported action from the wallet.', 'Open Activity to review the locally recorded result.', 'Use the explorer link for the chain-level transaction record.'],
    note: 'This is not a complete on-chain history indexer. Incoming transfers and older transactions may not appear unless an indexer is added.'
  }
]

const publicPages = {
  '/': { title: 'Mamba Wallet', description: 'A clear view of your Bitcoin, Polygon, and Solana wallets.' },
  '/developers': { title: 'Built with WDK', description: 'How MAMBA uses Tether WDK in its server-side wallet architecture.' },
  '/updates': { title: 'Updates', description: 'Public product notes from MAMBA Wallet.' },
  '/trust': { title: 'Trust and security', description: 'The current MAMBA wallet security model and its limits.' },
  '/risks': { title: 'Risks', description: 'Important wallet, network, and swap risks to understand.' },
  '/privacy': { title: 'Privacy draft', description: 'A review draft describing data used by this MAMBA project.' },
  '/terms': { title: 'Terms draft', description: 'A review draft for MAMBA Wallet terms.' }
}

const faqs = [
  {
    question: 'Which networks are configured by default?',
    answer: 'The current defaults are Bitcoin testnet, Polygon Amoy, and Solana devnet. The active EVM chain and provider URLs are controlled by server environment variables.'
  },
  {
    question: 'Does MAMBA store my recovery phrase in the browser?',
    answer: 'The current app stores an encrypted recovery phrase on the Express server. WDK runs server-side; the browser receives public account data and transaction results. This is not a client-only wallet architecture.'
  },
  {
    question: 'Can I swap Bitcoin or Solana assets?',
    answer: 'Not in the current project. The implemented swap flow is for EVM ERC-20 tokens through the WDK Velora module.'
  },
  {
    question: 'Does the dashboard show my full transaction history or fiat value?',
    answer: 'Not currently. Fiat pricing is not configured, and app activity is not a full on-chain history indexer.'
  }
]

function PublicSite({ pathname }) {
  const feature = features.find((item) => item.path === pathname)
  const route = publicPages[pathname]
  const title = feature?.label
    ? `${feature.label} | MAMBA Wallet`
    : pathname === '/'
      ? 'MAMBA Wallet | Bitcoin, Polygon, and Solana'
      : route?.title
        ? `${route.title} | MAMBA Wallet`
        : 'Page not found | MAMBA Wallet'

  React.useEffect(() => {
    document.title = title
    const description = document.querySelector('meta[name="description"]')
    if (description) description.content = feature?.description || route?.description || 'MAMBA Wallet product information and wallet access.'
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-revealed'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [feature, route, title])

  return (
    <div className="mamba-site">
      <a className="site-skip-link" href="#site-main">Skip to content</a>
      <SiteHeader />
      <main id="site-main">
        {pathname === '/' ? <HomePage /> : null}
        {feature ? <FeaturePage feature={feature} /> : null}
        {pathname === '/developers' ? <DevelopersPage /> : null}
        {pathname === '/updates' ? <UpdatesPage /> : null}
        {pathname === '/trust' ? <TrustPage /> : null}
        {pathname === '/risks' ? <RisksPage /> : null}
        {pathname === '/privacy' ? <DraftPage type="privacy" /> : null}
        {pathname === '/terms' ? <DraftPage type="terms" /> : null}
        {!feature && !route ? <NotFoundPage /> : null}
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container site-header-inner">
        <a className="site-brand" href="/" aria-label="MAMBA Wallet home">
          <MambaLogo />
          <span><strong>MAMBA</strong><small>WALLET</small></span>
        </a>
        <details className="site-navigation">
          <summary aria-label="Open site navigation">Explore <ChevronDown aria-hidden="true" /></summary>
          <div className="site-nav-popover">
            <span className="site-nav-label">WALLET FEATURES</span>
            {features.map((feature) => <a key={feature.path} href={feature.path}>{feature.label}<ArrowUpRight aria-hidden="true" /></a>)}
            <span className="site-nav-label site-nav-label-project">PROJECT</span>
            <a href="/developers">Built with WDK<ArrowUpRight aria-hidden="true" /></a>
            <a href="/trust">Trust and security<ArrowUpRight aria-hidden="true" /></a>
            <a href="/updates">Updates<ArrowUpRight aria-hidden="true" /></a>
          </div>
        </details>
        <nav className="site-header-links" aria-label="Main navigation">
          <a href="/developers">Built with WDK</a>
          <a href="/trust">Trust</a>
          <a href="/updates">Updates</a>
        </nav>
        <a className="site-button site-button-light site-header-cta" href="/app">Open wallet <ArrowUpRight aria-hidden="true" /></a>
      </div>
    </header>
  )
}

function HomePage() {
  return (
    <>
      <section className="site-hero">
        <div className="site-container site-hero-grid">
          <div className="site-hero-copy">
            <p className="site-kicker"><span /> MULTICHAIN WALLET, BUILT WITH TETHER WDK</p>
            <h1>MAMBA<br /><span>Wallet.</span></h1>
            <p className="site-hero-lede">Bitcoin, Polygon, and Solana. One clear place to see your wallet and act with care.</p>
            <div className="site-hero-actions">
              <a className="site-button site-button-light" href="/app">Open your wallet <ArrowUpRight aria-hidden="true" /></a>
              <a className="site-text-link site-text-link-light" href="/features/multichain">Explore the wallet <ArrowRight aria-hidden="true" /></a>
            </div>
            <p className="site-hero-caption">Test networks by default: Bitcoin testnet, Polygon Amoy, Solana devnet.</p>
          </div>
          <div className="site-hero-visual">
            <ProductPreview mode="overview" />
          </div>
        </div>
        <NetworkTicker />
      </section>

      <section className="site-section site-how-section">
        <div className="site-container">
          <SectionIntro kicker="A CLEARER WAY THROUGH" title="Your wallet, without the guesswork." text="MAMBA brings the details forward before you move assets." />
          <div className="site-steps" data-reveal>
            <Step number="01" title="Create or import" text="Register and create a wallet, or import a recovery phrase through the protected app." />
            <Step number="02" title="See each network" text="Check addresses and native balances for Bitcoin, Polygon EVM, and Solana." />
            <Step number="03" title="Review, then act" text="Preview supported sends and swaps, inspect the fee details, and confirm deliberately." />
          </div>
        </div>
      </section>

      <section className="site-section site-features-section">
        <div className="site-container">
          <SectionIntro kicker="MADE FOR THE EVERYDAY FLOW" title="Useful tools. Clear edges." text="Each part of MAMBA is built around a real wallet action, not a promise of features that are not here." />
          <div className="site-feature-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <a className={`site-feature-tile tile-${index + 1}`} href={feature.path} key={feature.path} data-reveal>
                  <span className="site-feature-icon"><Icon aria-hidden="true" /></span>
                  <span className="site-feature-count">0{index + 1}</span>
                  <h3>{feature.label}</h3>
                  <p>{feature.description}</p>
                  <span className="site-feature-more">View feature <ArrowUpRight aria-hidden="true" /></span>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <section className="site-section site-security-section">
        <div className="site-container site-security-grid" data-reveal>
          <div>
            <p className="site-kicker"><span /> SECURITY, WITHOUT THE BLIND SPOTS</p>
            <h2>Understand where your keys live.</h2>
            <p className="site-section-lede">MAMBA keeps the recovery phrase out of browser storage, but the current wallet is server-backed. Read the model and its limits before using it.</p>
            <a className="site-text-link site-text-link-light" href="/trust">Read the trust and security notes <ArrowRight aria-hidden="true" /></a>
          </div>
          <div className="site-security-facts">
            <Fact icon={Lock} title="Encrypted at rest" text="The server encrypts the recovery phrase with AES-256-GCM and a key derived from the account password." />
            <Fact icon={ShieldCheck} title="WDK stays server-side" text="The browser receives public wallet data and transaction results; the Express server initializes WDK." />
            <Fact icon={CircleHelp} title="Know the trade-off" text="This is not a client-only wallet. The server processes the decrypted phrase in memory while handling wallet actions." />
          </div>
        </div>
      </section>

      <section className="site-section site-faq-section">
        <div className="site-container site-faq-layout">
          <SectionIntro kicker="GOOD TO KNOW" title="Questions, answered plainly." text="A few important boundaries of the current MAMBA project." />
          <div className="site-faq-list">
            {faqs.map((faq) => <Faq key={faq.question} {...faq} />)}
            <a className="site-text-link" href="/risks">Read all wallet risks <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <UpdatesTeaser />
    </>
  )
}

function FeaturePage({ feature }) {
  const Icon = feature.icon
  return (
    <>
      <section className="site-feature-hero">
        <div className="site-container site-feature-hero-grid">
          <div className="site-feature-copy">
            <p className="site-kicker"><span /> MAMBA WALLET / {feature.label.toUpperCase()}</p>
            <h1>{feature.title}</h1>
            <p className="site-hero-lede">{feature.description}</p>
            <div className="site-hero-actions">
              <a className="site-button site-button-light" href="/app">Open your wallet <ArrowUpRight aria-hidden="true" /></a>
              <a className="site-text-link site-text-link-light" href="/">Back to overview <ArrowRight aria-hidden="true" /></a>
            </div>
          </div>
          <div className="site-feature-visual">
            <ProductPreview mode={feature.preview} Icon={Icon} />
          </div>
        </div>
      </section>
      <section className="site-section site-feature-details">
        <div className="site-container site-feature-detail-grid">
          <div>
            <SectionIntro kicker="WHAT YOU CAN DO" title="Built around the details that matter." text={feature.description} />
            <ul className="site-check-list">
              {feature.points.map((point) => <li key={point}><span><ShieldCheck aria-hidden="true" /></span>{point}</li>)}
            </ul>
          </div>
          <aside className="site-note-panel">
            <p className="site-kicker">CURRENT SCOPE</p>
            <p>{feature.note}</p>
            <a href="/risks" className="site-text-link">Read related risks <ArrowRight aria-hidden="true" /></a>
          </aside>
        </div>
      </section>
      <section className="site-section site-steps-section">
        <div className="site-container">
          <SectionIntro kicker="HOW IT WORKS" title="A small number of deliberate steps." />
          <div className="site-steps" data-reveal>
            {feature.steps.map((step, index) => <Step key={step} number={`0${index + 1}`} title={`Step ${index + 1}`} text={step} />)}
          </div>
        </div>
      </section>
      <section className="site-section site-feature-faq">
        <div className="site-container site-faq-layout">
          <SectionIntro kicker="MORE DETAIL" title="Before you begin." text="Understand the network and feature boundaries." />
          <div className="site-faq-list">
            <Faq question="Which network will I use?" answer="The wallet labels each configured network. The current defaults are Bitcoin testnet, Polygon Amoy, and Solana devnet." />
            <Faq question="Is this feature available on every chain?" answer={feature.note} />
            <Faq question="Where can I read about the security model?" answer="The Trust page explains the current server-backed key handling and the limits of this project." />
            <a className="site-text-link" href="/trust">Trust and security <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>
    </>
  )
}

function ProductPreview({ mode, Icon = WalletCards }) {
  const content = {
    overview: {
      eyebrow: 'ACCOUNT OVERVIEW',
      title: 'Your networks',
      rows: [['BTC', 'Bitcoin testnet'], ['POL', 'Polygon Amoy'], ['SOL', 'Solana devnet']],
      footer: 'Balances load securely when you sign in.'
    },
    send: {
      eyebrow: 'TRANSACTION REVIEW',
      title: 'Check before sending',
      rows: [['Network', 'Selected in wallet'], ['Recipient', 'Address validation'], ['Fee and total', 'Preview before confirm']],
      footer: 'Never broadcast before your final confirmation.'
    },
    swap: {
      eyebrow: 'EVM TOKEN SWAP',
      title: 'Quote, then review',
      rows: [['Route', 'Velora quote'], ['Minimum received', 'Slippage-aware'], ['Network fee', 'Shown in preview']],
      footer: 'Swap availability is EVM-only in the current app.'
    },
    assets: {
      eyebrow: 'ASSET VIEW',
      title: 'Balances by network',
      rows: [['Native assets', 'BTC / POL / SOL'], ['Custom tokens', 'EVM ERC-20'], ['Fiat pricing', 'Not configured']],
      footer: 'No sample prices or account balances are shown.'
    },
    activity: {
      eyebrow: 'ACTIVITY CENTER',
      title: 'App-submitted actions',
      rows: [['Sends', 'Recorded after submission'], ['Swaps', 'Explorer link when available'], ['Full chain history', 'Indexer not configured']],
      footer: 'Incoming chain events are not indexed by this app.'
    }
  }[mode]

  return (
    <div className="site-product-shell">
      <div className="site-product-topline">
        <MambaLogo />
        <span>MAMBA <small>WALLET PREVIEW</small></span>
        <span className="site-preview-icon"><Icon aria-hidden="true" /></span>
      </div>
      <div className="site-product-body">
        <p className="site-product-eyebrow">{content.eyebrow}</p>
        <h2>{content.title}</h2>
        {mode === 'overview' ? <div className="site-preview-balance"><span>Portfolio value</span><strong>Available in wallet</strong></div> : null}
        <div className="site-preview-rows">
          {content.rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <p className="site-preview-footnote">{content.footer}</p>
      </div>
      <span className="site-preview-disclaimer">Interface illustration. No live account data.</span>
    </div>
  )
}

function NetworkTicker() {
  const networks = ['BITCOIN TESTNET', 'POLYGON AMOY', 'SOLANA DEVNET']
  return (
    <div className="site-network-band" aria-label="Current default networks">
      <div className="site-network-track">
        {[0, 1].map((copy) => (
          <div className="site-network-group" key={copy} aria-hidden={copy === 1 ? 'true' : undefined}>
            {networks.map((network) => <span key={network}><i />{network}</span>)}
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionIntro({ kicker, title, text }) {
  return (
    <div className="site-section-intro" data-reveal>
      <p className="site-kicker"><span /> {kicker}</p>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  )
}

function Step({ number, title, text }) {
  return (
    <article className="site-step">
      <span className="site-step-number">{number}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </article>
  )
}

function Fact({ icon: Icon, title, text }) {
  return (
    <article className="site-security-fact">
      <Icon aria-hidden="true" />
      <div><h3>{title}</h3><p>{text}</p></div>
    </article>
  )
}

function Faq({ question, answer }) {
  return (
    <details className="site-faq-item">
      <summary>{question}<ChevronDown aria-hidden="true" /></summary>
      <p>{answer}</p>
    </details>
  )
}

function UpdatesTeaser() {
  return (
    <section className="site-section site-updates-teaser">
      <div className="site-container site-updates-row" data-reveal>
        <div><p className="site-kicker">FIELD NOTES</p><h2>No public release notes yet.</h2><p>We will publish product updates here when there is something real to share.</p></div>
        <a className="site-text-link" href="/updates">Visit updates <ArrowRight aria-hidden="true" /></a>
      </div>
    </section>
  )
}

function ContentPage({ kicker, title, intro, children }) {
  return (
    <>
      <section className="site-page-hero">
        <div className="site-container" data-reveal>
          <p className="site-kicker"><span /> {kicker}</p>
          <h1>{title}</h1>
          <p className="site-hero-lede">{intro}</p>
        </div>
      </section>
      <section className="site-section site-content-section"><div className="site-container site-prose" data-reveal>{children}</div></section>
    </>
  )
}

function DevelopersPage() {
  return (
    <ContentPage kicker="FOR BUILDERS" title="Built with Tether WDK." intro="MAMBA uses WDK inside its Express backend to configure and operate the wallet managers. The project does not currently expose a public MAMBA SDK or developer API.">
      <h2>Modules used by this project</h2>
      <ul>
        <li><code>@tetherto/wdk</code> initializes the wallet orchestrator from the decrypted recovery phrase.</li>
        <li><code>@tetherto/wdk-wallet-btc</code> registers the Bitcoin wallet manager with an Electrum provider.</li>
        <li><code>@tetherto/wdk-wallet-evm</code> registers the configured EVM network wallet.</li>
        <li><code>@tetherto/wdk-wallet-solana</code> registers the configured Solana wallet.</li>
        <li><code>@tetherto/wdk-protocol-swap-velora-evm</code> supplies the current EVM token swap integration.</li>
      </ul>
      <h2>Architecture at a glance</h2>
      <p>The React app calls private Express routes. The server loads provider configuration, initializes WDK, and returns public account data, quotes, and transaction results. Recovery phrases and private keys are not sent in ordinary wallet API responses.</p>
      <p>For current APIs and module configuration, use Tether's official documentation. These project details describe this repository, not a stable public integration contract.</p>
      <a className="site-button site-button-dark" href="https://docs.wdk.tether.io/" target="_blank" rel="noreferrer">Read WDK documentation <ExternalLink aria-hidden="true" /></a>
    </ContentPage>
  )
}

function UpdatesPage() {
  return (
    <ContentPage kicker="MAMBA / UPDATES" title="Product notes, when they are ready." intro="There are no published MAMBA release notes or articles in this project yet. This page will only list dated updates that are actually written and verified.">
      <div className="site-empty-editorial"><FileClock aria-hidden="true" /><div><h2>No updates published</h2><p>Nothing to announce today. You can still explore the current wallet features and their documented limits.</p><a className="site-text-link" href="/features/multichain">Explore wallet features <ArrowRight aria-hidden="true" /></a></div></div>
    </ContentPage>
  )
}

function TrustPage() {
  return (
    <ContentPage kicker="TRUST AND SECURITY" title="Know how this wallet is built." intro="MAMBA's current implementation keeps WDK operations on an Express server and encrypts recovery phrases at rest. That architecture has important trade-offs; read the details before using it.">
      <h2>Recovery phrase handling</h2>
      <p>At registration, the server encrypts the phrase with AES-256-GCM. The encryption key is derived from the user's password with scrypt. The encrypted vault is stored in the project's local user data file. The raw password is not stored as the password verifier.</p>
      <h2>Wallet operations</h2>
      <p>After sign-in, the Express server uses the session's derived unlock key to decrypt the phrase when it initializes WDK. WDK creates and uses the Bitcoin, EVM, and Solana accounts server-side. Ordinary wallet responses contain public addresses, balances, QR data, quotes, and transaction outcomes, not the phrase.</p>
      <h2>What this means for you</h2>
      <ul>
        <li>This is a server-backed wallet, not a client-only wallet. The server process can access the phrase in memory while handling an action.</li>
        <li>Anyone who controls the running server or its user data needs to be considered in your threat model.</li>
        <li>Use test networks while evaluating the project. Do not treat a local development setup as production custody infrastructure.</li>
        <li>This project does not link an independent MAMBA security audit. No audit claim is made here.</li>
      </ul>
      <h2>External providers</h2>
      <p>Wallet balance, quote, and broadcast requests use the configured RPC and Electrum providers. Those providers may observe network metadata such as public addresses and requests. Review provider terms and privacy practices before configuring production endpoints.</p>
      <a className="site-text-link" href="/risks">Read wallet and network risks <ArrowRight aria-hidden="true" /></a>
    </ContentPage>
  )
}

function RisksPage() {
  return (
    <ContentPage kicker="RISK DISCLOSURE" title="Digital assets carry real risk." intro="Read this summary before using MAMBA. It is not exhaustive and is not financial, legal, or tax advice.">
      <h2>Recovery phrase and server risk</h2>
      <p>Anyone who obtains a usable recovery phrase can control its derived accounts. MAMBA's server decrypts the phrase in memory to perform wallet operations. A compromised password, server, local user store, or unsafe deployment can put funds at risk.</p>
      <h2>Network and provider risk</h2>
      <p>Blockchains can be congested, unavailable, or subject to changing fees. RPC and Electrum providers can fail, return delayed data, or observe public wallet activity. Transactions generally cannot be reversed once confirmed.</p>
      <h2>Swap and token risk</h2>
      <p>EVM swaps depend on a quote and external protocol behavior. Expected output, price impact, fees, and slippage can change. Token contracts may be malicious, illiquid, upgradeable, or misrepresented by metadata. Review token addresses and all transaction details before confirming.</p>
      <h2>Test network warning</h2>
      <p>The project's default networks are Bitcoin testnet, Polygon Amoy, and Solana devnet. Test tokens usually have no monetary value. If you change configuration to a mainnet, transactions can spend real assets.</p>
      <h2>Scope and assurance</h2>
      <p>Fiat pricing, full transaction indexing, WalletConnect, and approval revocation are not configured features in the current project. MAMBA does not link an independent audit report here. Do not infer that either the app or an external provider is risk-free.</p>
      <a className="site-text-link" href="/trust">Review the security model <ArrowRight aria-hidden="true" /></a>
    </ContentPage>
  )
}

function DraftPage({ type }) {
  const isPrivacy = type === 'privacy'
  return (
    <ContentPage
      kicker={`MAMBA / ${isPrivacy ? 'PRIVACY' : 'TERMS'}`}
      title={isPrivacy ? 'Privacy notice draft.' : 'Terms draft.'}
      intro="This is draft project copy for review, not a final legal notice. Confirm the operator, jurisdiction, retention, support, and deployment details with qualified counsel before publishing."
    >
      {isPrivacy ? <>
        <div className="site-draft-alert"><CircleHelp aria-hidden="true" /><p><strong>Draft for review.</strong> This summary reflects the current repository's local implementation and must be updated for any deployed service.</p></div>
        <h2>Data handled by the current app</h2>
        <ul>
          <li>Account username and a scrypt-derived password verifier.</li>
          <li>An encrypted recovery phrase, encrypted with AES-256-GCM and a key derived from the password.</li>
          <li>Saved contacts, custom EVM token entries, app activity, and notifications associated with the account.</li>
          <li>Temporary authenticated session state held by the server.</li>
        </ul>
        <h2>Network requests</h2>
        <p>Configured blockchain RPC, Electrum, and swap providers receive requests needed for wallet features. Public addresses and transaction requests are not private blockchain data; provider practices should be reviewed before use.</p>
        <h2>Storage and retention</h2>
        <p>The local development project stores account records in a server-side JSON data file. A production deployment must specify its actual hosting, backups, retention schedule, deletion process, and contact for privacy requests before this text is finalized.</p>
        <h2>Items requiring owner review</h2>
        <p>Identify the service operator, applicable jurisdictions, legal basis, retention periods, provider list, user rights, deletion workflow, and a privacy contact. Do not publish this draft as a complete privacy policy.</p>
      </> : <>
        <div className="site-draft-alert"><CircleHelp aria-hidden="true" /><p><strong>Draft for review.</strong> The project owner must define the service provider, jurisdiction, support channel, and governing terms before publication.</p></div>
        <h2>What this application is</h2>
        <p>MAMBA is a wallet interface backed by server-side WDK operations. It supports the networks and features described on this site, subject to provider configuration and availability.</p>
        <h2>User responsibilities</h2>
        <p>Users should protect their password and recovery phrase, verify the network and recipient before confirming, and understand that blockchain transactions are generally irreversible. Test networks should be used for evaluation.</p>
        <h2>Important scope</h2>
        <p>Digital asset values may change, providers may be unavailable, and integrations may fail. The current project does not provide financial, legal, or tax advice. This draft does not define warranties, liability limits, dispute procedures, or governing law.</p>
        <h2>Items requiring owner review</h2>
        <p>Obtain legal review and complete the operator identity, contact details, governing law, warranty and liability terms, prohibited uses, termination, and dispute process before treating these terms as effective.</p>
      </>}
    </ContentPage>
  )
}

function NotFoundPage() {
  return <ContentPage kicker="404 / NOT FOUND" title="This page is out of reach." intro="The link may have moved. Return to the wallet overview or open the app."><a className="site-button site-button-dark" href="/">Go home <ArrowRight aria-hidden="true" /></a></ContentPage>
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <a className="site-brand" href="/" aria-label="MAMBA Wallet home"><MambaLogo /><span><strong>MAMBA</strong><small>WALLET</small></span></a>
            <p>One clear place for Bitcoin, Polygon, and Solana wallet actions.</p>
            <a className="site-button site-button-light" href="/app">Open wallet <ArrowUpRight aria-hidden="true" /></a>
          </div>
          <FooterGroup title="Wallet" links={features.map((feature) => [feature.label, feature.path])} />
          <FooterGroup title="Project" links={[["Built with WDK", '/developers'], ['Updates', '/updates'], ['Trust and security', '/trust'], ['Risks', '/risks']]} />
          <FooterGroup title="Legal drafts" links={[["Privacy (draft)", '/privacy'], ['Terms (draft)', '/terms']]} />
        </div>
        <div className="site-footer-bottom"><span>© {new Date().getFullYear()} MAMBA Wallet</span><span>Bitcoin testnet · Polygon Amoy · Solana devnet</span></div>
      </div>
    </footer>
  )
}

function FooterGroup({ title, links }) {
  return <nav className="site-footer-group" aria-label={title}><h2>{title}</h2>{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
}

export default PublicSite
