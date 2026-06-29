import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-brand-dark text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Maddiq</h1>
          <p className="text-xs text-brand-gold">AI-native accounting</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-white/70 hover:text-white transition">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-brand-gold text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            Start free trial
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-32 text-center">
        <div className="inline-block bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs font-semibold px-4 py-2 rounded-full mb-8">
          🚀 The future of accounting practice management
        </div>
        <h2 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-8">
          Your entire practice.<br />
          <span className="text-brand-gold">Powered by AI.</span>
        </h2>
        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Maddiq is the AI-native CRM and accounting platform built for modern UK accounting firms.
          Manage clients, deadlines, documents and compliance — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-brand-gold text-brand-dark font-bold px-8 py-4 rounded-xl text-base hover:bg-opacity-90 transition"
          >
            Start free trial →
          </Link>
          <Link
            href="/portal/login"
            className="border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base hover:bg-white/10 transition"
          >
            Client portal login
          </Link>
        </div>
        <p className="text-white/30 text-sm mt-6">No credit card required · Setup in 2 minutes</p>
      </section>

      {/* Features */}
      <section className="bg-white/5 border-t border-white/10 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white mb-4">
              Everything your firm needs
            </h3>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Built by accountants, for accountants. Every feature designed around how UK practices actually work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '👤',
                title: 'Client Management',
                description: 'Full client records with Companies House integration, tax references, directors, CIS status and engagement history — all in one place.',
              },
              {
                icon: '💰',
                title: 'Tax Information',
                description: 'Store CT UTRs, PAYE references, VAT schemes, CIS status, SA details and Companies House authentication codes securely.',
              },
              {
                icon: '📋',
                title: 'Engagement Tracking',
                description: 'Track every service you provide — bookkeeping, VAT, CT, payroll, accounts — with fees, frequency and status.',
              },
              {
                icon: '📅',
                title: 'Deadline Management',
                description: 'Never miss a filing deadline. Track VAT returns, CT deadlines, confirmation statements and SA submissions across your whole client base.',
              },
              {
                icon: '📄',
                title: 'Document Management',
                description: 'Secure document storage with client sharing. Share accounts, tax returns and correspondence directly to your client portal.',
              },
              {
                icon: '🔗',
                title: 'Client Portal',
                description: 'Give clients their own secure portal to view and download shared documents — branded, professional and always available.',
              },
              {
                icon: '✅',
                title: 'Task Management',
                description: 'Assign tasks to team members, set priorities and due dates, and track progress across your entire client portfolio.',
              },
              {
                icon: '📝',
                title: 'Threaded Notes',
                description: 'Log client communications with threaded notes and replies. Build a full history of every interaction with every client.',
              },
              {
                icon: '🤖',
                title: 'AI Tax Advisor',
                description: 'Industry-specific AI tax guidance built into every client record. The right advice, for the right industry, at the right time. Coming soon.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-brand-gold/50 hover:bg-white/8 transition-all"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for UK firms */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h3 className="text-3xl font-bold text-white mb-6">
                Built specifically for<br />
                <span className="text-brand-gold">UK accounting firms</span>
              </h3>
              <div className="space-y-4">
                {[
                  'Companies House integration and authentication codes',
                  'HMRC reference storage — CT UTR, PAYE, VAT, SA, CIS',
                  'MTD-ready with VAT scheme and quarter tracking',
                  'CIS contractor and subcontractor management',
                  'UK statutory deadline library built in',
                  'ICAEW and ACCA practice-aware workflows',
                  'UK GDPR compliant document handling',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="text-brand-gold mt-0.5 shrink-0">✓</span>
                    <p className="text-white/70 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center">
                  <span className="text-brand-dark font-bold text-sm">M</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Maddock & Co</p>
                  <p className="text-white/40 text-xs">Active · Accounting</p>
                </div>
                <span
