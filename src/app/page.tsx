import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FileStack,
  Globe2,
  Layers3,
  LineChart,
  PlayCircle,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { PLAN_CONFIG, type SubscriptionPlan } from '@/types'

const PLAN_ORDER: SubscriptionPlan[] = ['free', 'pro', 'agency']

const PLATFORM_TAGS = [
  'Google Search',
  'Meta Ads',
  'LinkedIn',
  'YouTube',
  'Shopping',
  'Demand Gen',
  'Performance Max',
]

const HERO_STATS = [
  { value: '8 min', label: 'to first campaign blueprint' },
  { value: '7', label: 'ad channels supported' },
  { value: '1 workspace', label: 'for analysis, creatives, and reports' },
]

const FEATURE_PANELS = [
  {
    icon: Globe2,
    title: 'Business and website intelligence',
    description: 'Paste a URL and get positioning, USP, ICP, objections, and market context without the usual discovery slog.',
    tone: 'from-sky-500/15 to-cyan-500/5 border-sky-200/60',
  },
  {
    icon: Radar,
    title: 'Competitor and market mapping',
    description: 'See the gaps competitors leave open, then turn those into message angles and budget priorities.',
    tone: 'from-emerald-500/15 to-teal-500/5 border-emerald-200/60',
  },
  {
    icon: Layers3,
    title: 'Cross-platform campaign blueprints',
    description: 'Generate structure, targeting, keywords, ad copy, creative directions, and platform-specific settings.',
    tone: 'from-violet-500/15 to-indigo-500/5 border-violet-200/60',
  },
  {
    icon: LineChart,
    title: 'Forecasts before launch',
    description: 'Model CPC, CTR, CPA, and ROAS expectations before budget gets committed to the wrong channel mix.',
    tone: 'from-amber-500/15 to-orange-500/5 border-amber-200/60',
  },
]

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Capture the brief',
    description: 'Define website, market, budget, goals, and target regions in one clean project setup.',
  },
  {
    step: '02',
    title: 'Let AI build the strategy layer',
    description: 'AdPilot combines business analysis, competitor research, landing audit, and channel planning.',
  },
  {
    step: '03',
    title: 'Generate campaigns and creatives',
    description: 'Move from strategy into platform-ready campaigns, ad concepts, scripts, and reporting assets.',
  },
]

const TRUST_POINTS = [
  'Client-ready PDF and PPT exports',
  'Creative Studio and landing audit for Pro and above',
  'Team collaboration and white-labeling on Agency',
]

const TESTIMONIALS = [
  {
    quote: 'AdPilot turned our kickoff questionnaire, competitor scan, and campaign draft into one workflow.',
    name: 'Priya Sharma',
    role: 'Head of Marketing, B2B SaaS',
  },
  {
    quote: 'The team can preview strategy, reporting, and account structure before we commit a rupee to media.',
    name: 'Rahul Mehta',
    role: 'Founder, Performance Agency',
  },
  {
    quote: 'The landing audit and forecasting combo helps us pressure-test offers before launch, not after.',
    name: 'Anjali Nair',
    role: 'Growth Lead, Ecommerce Brand',
  },
]

const PLAN_SUMMARY: Record<
  SubscriptionPlan,
  {
    badge: string
    heading: string
    href: string
    cardClass: string
    buttonClass: string
  }
> = {
  free: {
    badge: 'For solo testing',
    heading: 'Start with core planning essentials.',
    href: '/signup',
    cardClass: 'border-gray-200 bg-white',
    buttonClass: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
  },
  pro: {
    badge: 'Best for growth teams',
    heading: 'Unlock every planning and reporting workflow.',
    href: '/signup?plan=pro',
    cardClass: 'border-brand-500 bg-slate-950 text-white shadow-2xl shadow-brand-500/10',
    buttonClass: 'bg-white text-slate-950 hover:bg-brand-50',
  },
  agency: {
    badge: 'Built for client ops',
    heading: 'Add team access, white-labeling, and multi-client scale.',
    href: '/signup?plan=agency',
    cardClass: 'border-violet-200 bg-white',
    buttonClass: 'border border-violet-200 text-violet-700 hover:bg-violet-50',
  },
}

const COMPARISON_ROWS = [
  { label: 'Project limit', values: { free: '3', pro: 'Unlimited', agency: 'Unlimited' } },
  { label: 'Platforms', values: { free: 'Google + Meta', pro: 'All 7', agency: 'All 7' } },
  { label: 'Competitor intelligence', values: { free: 'No', pro: 'Yes', agency: 'Yes' } },
  { label: 'Creative Studio', values: { free: 'No', pro: 'Yes', agency: 'Yes' } },
  { label: 'Landing page audit', values: { free: 'No', pro: 'Yes', agency: 'Yes' } },
  { label: 'Reports export', values: { free: 'CSV only', pro: 'PDF + PPT', agency: 'PDF + PPT' } },
  { label: 'Team members', values: { free: '1', pro: '3', agency: 'Unlimited' } },
  { label: 'White label', values: { free: 'No', pro: 'No', agency: 'Yes' } },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-18 min-h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#4f46e5_55%,#38bdf8_100%)] flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">AdPilot AI</div>
              <div className="text-xs text-slate-500">AI campaign planning workspace</div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-950 transition-colors">Features</a>
            <a href="#workflow" className="hover:text-slate-950 transition-colors">Workflow</a>
            <a href="#plans" className="hover:text-slate-950 transition-colors">Plans</a>
            <Link href="/login" className="hover:text-slate-950 transition-colors">Sign in</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="hidden sm:inline-flex px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Start Free
            </Link>
            <Link
              href="/signup?plan=pro"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Try Pro
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#ffffff_58%)]">
        <div className="absolute inset-0 bg-grid-pattern opacity-60" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-28">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white/90 shadow-sm text-sm font-medium text-slate-700">
                <Bot className="w-4 h-4 text-brand-600" />
                Campaign planning, audits, creatives, and reports in one system
              </div>

              <h1 className="mt-8 text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[0.96] text-balance">
                Make strategy feel
                <span className="block bg-[linear-gradient(135deg,#0f172a_0%,#4f46e5_55%,#0ea5e9_100%)] bg-clip-text text-transparent">
                  faster, sharper, and easier to scale.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg md:text-xl text-slate-600 leading-relaxed">
                AdPilot turns a website URL into business analysis, competitor research, landing-page feedback,
                channel strategy, campaign builds, creative ideas, and reporting assets across every major plan tier.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-950 text-white font-medium hover:bg-slate-800 transition-colors"
                >
                  Create a free workspace
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  <PlayCircle className="w-4 h-4 text-brand-600" />
                  Compare all plans
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-2">
                {PLATFORM_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full border border-white/70 bg-white/90 shadow-sm text-sm text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-10 grid sm:grid-cols-3 gap-4">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/80 bg-white/85 backdrop-blur p-4 shadow-sm">
                    <div className="text-2xl font-semibold text-slate-950">{stat.value}</div>
                    <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-8 -left-6 w-24 h-24 rounded-full bg-sky-300/30 blur-3xl" />
              <div className="absolute -bottom-8 -right-6 w-28 h-28 rounded-full bg-violet-300/30 blur-3xl" />

              <div className="relative rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div>
                    <div className="text-sm font-medium">AI Planning Workspace</div>
                    <div className="text-xs text-slate-400">Preview every version before rollout</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    Feature visibility enabled
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Strategy pipeline</div>
                        <div className="text-xs text-slate-400 mt-1">From URL to launch-ready assets</div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-100 text-xs">
                        7 channels
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {[
                        { label: 'Business analysis', status: 'Complete' },
                        { label: 'Competitor intelligence', status: 'Ready for Pro+' },
                        { label: 'Creative Studio', status: 'Ready for Pro+' },
                        { label: 'Team collaboration', status: 'Ready for Agency' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 py-2.5">
                          <span className="text-sm text-slate-100">{item.label}</span>
                          <span className="text-xs text-slate-400">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {PLAN_ORDER.map((planId) => {
                      const plan = PLAN_CONFIG[planId]
                      const cardTone = planId === 'pro'
                        ? 'border-brand-400/40 bg-brand-500/15'
                        : planId === 'agency'
                        ? 'border-violet-400/30 bg-violet-500/10'
                        : 'border-white/10 bg-white/5'

                      return (
                        <div key={planId} className={`rounded-2xl border p-4 ${cardTone}`}>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{plan.name}</div>
                          <div className="mt-3 text-2xl font-semibold">
                            {plan.price_monthly === 0 ? 'Free' : `Rs ${plan.price_monthly.toLocaleString()}`}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {plan.price_monthly === 0 ? 'Core planning access' : 'Per month'}
                          </div>
                          <div className="mt-4 text-sm text-slate-200">{plan.features[0]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
            <div className="max-w-2xl">
              <div className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Why teams use it</div>
              <h2 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">
                A serious planning stack, not just a campaign generator.
              </h2>
            </div>
            <div className="max-w-xl text-slate-600 leading-relaxed">
              Strategy work usually breaks across docs, decks, spreadsheets, and ad-platform drafts.
              AdPilot compresses that workflow into one operating surface.
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FEATURE_PANELS.map(({ icon: Icon, title, description, tone }) => (
              <div
                key={title}
                className={`rounded-[26px] border bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-7 shadow-sm ${tone}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-8 grid lg:grid-cols-[1fr_0.95fr] gap-8">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Built for visibility</div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">See what each version unlocks before rollout.</h3>
              <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl">
                Free covers core planning. Pro adds deeper analysis, creative generation, and reporting.
                Agency layers in collaboration and white-label delivery for client operations.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div className="mt-3 text-sm font-medium text-slate-900 leading-relaxed">{point}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-24 px-6 bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Workflow</div>
              <h2 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">
                One path from brief to campaign system.
              </h2>
              <p className="mt-5 text-slate-300 leading-relaxed max-w-xl">
                Use it as a planning cockpit for your internal team or as a faster delivery layer for clients.
              </p>

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-brand-500/20 text-brand-200 flex items-center justify-center">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">Launch readiness</div>
                    <div className="text-sm text-slate-400">Reports, exports, and team collaboration from the same project context.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.step} className="rounded-[26px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-5">
                    <div className="text-4xl font-semibold text-white/15">{step.step}</div>
                    <div>
                      <h3 className="text-xl font-semibold">{step.title}</h3>
                      <p className="mt-2 text-slate-300 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.name} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Sparkles key={index} className="w-4 h-4" />
                  ))}
                </div>
                <p className="mt-5 text-slate-700 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-6">
                  <div className="font-medium text-slate-950">{testimonial.name}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="py-24 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Plans</div>
            <h2 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">
              Free, Pro, and Agency side by side.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Use Free to validate the workflow, Pro to run the full planning stack, and Agency to support delivery at client scale.
            </p>
          </div>

          <div className="mt-14 grid lg:grid-cols-3 gap-6">
            {PLAN_ORDER.map((planId) => {
              const plan = PLAN_CONFIG[planId]
              const meta = PLAN_SUMMARY[planId]
              const priceLabel = plan.price_monthly === 0 ? 'Free' : `Rs ${plan.price_monthly.toLocaleString()}`
              const subdued = planId === 'pro' ? 'text-slate-300' : 'text-slate-500'
              const textTone = planId === 'pro' ? 'text-white' : 'text-slate-950'
              const featureTone = planId === 'pro' ? 'text-slate-200' : 'text-slate-600'

              return (
                <div key={planId} className={`rounded-[28px] border p-7 ${meta.cardClass}`}>
                  <div className={`text-xs uppercase tracking-[0.18em] ${subdued}`}>{meta.badge}</div>
                  <h3 className={`mt-3 text-3xl font-semibold ${textTone}`}>{plan.name}</h3>
                  <p className={`mt-3 leading-relaxed ${featureTone}`}>{meta.heading}</p>

                  <div className={`mt-6 text-4xl font-semibold ${textTone}`}>
                    {priceLabel}
                    {plan.price_monthly > 0 && <span className={`text-lg font-normal ml-1 ${subdued}`}>/month</span>}
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className={`flex items-start gap-3 text-sm ${featureTone}`}>
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planId === 'pro' ? 'text-brand-300' : 'text-emerald-500'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={meta.href}
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-medium transition-colors ${meta.buttonClass}`}
                  >
                    {planId === 'agency' ? 'Talk to sales' : `Choose ${plan.name}`}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )
            })}
          </div>

          <div className="mt-12 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr] px-6 py-4 bg-slate-950 text-white text-sm font-medium">
              <div>Feature comparison</div>
              <div className="text-center">Free</div>
              <div className="text-center">Pro</div>
              <div className="text-center">Agency</div>
            </div>

            {COMPARISON_ROWS.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr] px-6 py-4 text-sm ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <div className="font-medium text-slate-800">{row.label}</div>
                <div className="text-center text-slate-600">{row.values.free}</div>
                <div className="text-center text-slate-600">{row.values.pro}</div>
                <div className="text-center text-slate-600">{row.values.agency}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="max-w-6xl mx-auto rounded-[32px] overflow-hidden border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#0ea5e9_100%)] text-white shadow-[0_30px_80px_rgba(15,23,42,0.20)]">
          <div className="px-8 py-12 md:px-12 md:py-14 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm">
                <Target className="w-4 h-4" />
                From planning friction to launch clarity
              </div>
              <h2 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight text-balance">
                Stop building campaign strategy in five different places.
              </h2>
              <p className="mt-4 max-w-2xl text-slate-200 leading-relaxed">
                Start with the free workspace, then move into Pro or Agency when you are ready to operationalize the full stack.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 bg-white text-slate-950 font-medium hover:bg-slate-100 transition-colors"
              >
                Start free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
              >
                Open dashboard
                <FileStack className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-10 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#4f46e5_55%,#38bdf8_100%)] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-medium text-slate-950">AdPilot AI</div>
              <div className="text-sm text-slate-500">Planning clarity for performance teams</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <a href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="/support" className="hover:text-slate-900 transition-colors">Support</a>
          </div>

          <div className="text-sm text-slate-400">Copyright 2026 AdPilot AI</div>
        </div>
      </footer>
    </div>
  )
}
