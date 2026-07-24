import type { Platform } from '@/types'

type ProjectLike = {
  name?: string
  website_url?: string
  monthly_budget?: number
  target_country?: string
  business_analysis?: {
    company_name?: string
    usp?: string[]
    target_audience?: string
    pain_points?: string[]
  } | null
}

function getCompany(project: ProjectLike) {
  return project.business_analysis?.company_name || project.name || 'Demo Brand'
}

function getBudget(project: ProjectLike) {
  return Math.max(Number(project.monthly_budget || 3000), 300)
}

export function createMockCampaignData(platform: Platform, project: ProjectLike) {
  const company = getCompany(project)
  const budget = getBudget(project)
  const dailyBudget = Number((budget / 30).toFixed(2))
  const audience = project.business_analysis?.target_audience || 'high-intent buyers and decision makers'
  const usps = project.business_analysis?.usp?.length
    ? project.business_analysis.usp
    : ['Fast setup', 'Clear ROI tracking', 'Expert campaign planning']

  // Test mode keeps the app usable on preview deployments without AI provider keys.
  return {
    structure: {
      campaign_name: `${company} - ${platform.replace(/_/g, ' ')} Test Campaign`,
      campaign_objective: platform === 'youtube' ? 'Video Views and Conversions' : 'Conversions',
      bid_strategy: platform === 'shopping' || platform === 'performance_max' ? 'Target ROAS' : 'Maximize Conversions',
      daily_budget: dailyBudget,
      ad_groups: [
        {
          name: 'Core Intent',
          keywords: [`${company} solution`, `${company} pricing`, `best ${company} alternative`],
          match_types: ['phrase', 'exact'],
          bids: { default: 2.5 },
          headlines: [`Try ${company}`, 'Launch Faster', 'Improve ROI'],
          descriptions: ['Built for teams that need campaign clarity before launch.'],
        },
      ],
      ad_sets: [
        {
          name: 'Primary Buyers',
          objective: 'Conversions',
          interests: ['Digital marketing', 'Business growth', 'SaaS'],
          lookalike_audiences: ['Website visitors lookalike'],
          remarketing_audiences: ['All website visitors 30 days'],
          age_min: 24,
          age_max: 54,
          gender: 'All',
          placements: ['Feed', 'Stories', 'Reels'],
        },
      ],
    },
    settings: {
      location_targeting: [project.target_country || 'India'],
      language_targeting: ['English'],
      ad_schedule: { weekdays: '09:00-21:00' },
      device_strategy: 'All devices with mobile bid monitoring',
    },
    ad_copy: {
      headlines: [
        `${company} Growth Plan`,
        'Launch Better Ads',
        'Find Winning Angles',
        'Plan Campaigns Fast',
        'Improve Your ROI',
      ],
      descriptions: [
        `Use ${company} to turn strategy into clear campaign actions.`,
        'Get audiences, copy, keywords, and budgets ready before launch.',
      ],
      primary_texts: [
        `${company} helps ${audience} move from guesswork to campaign clarity.`,
        `Build sharper ads with tested angles: ${usps.slice(0, 2).join(' and ')}.`,
      ],
      cta_options: ['Learn More', 'Get Started', 'Book Demo'],
      callouts: usps.slice(0, 4),
    },
    keywords: {
      broad: [`${company} marketing`, `${company} campaign`, 'growth strategy'],
      phrase: [`${company} ads`, 'campaign planning tool', 'marketing automation'],
      exact: [`${company}`, 'ad campaign planner'],
      negative: ['free jobs', 'template download', 'unrelated'],
    },
    audiences: {
      interest_targeting: ['Marketing managers', 'Founders', 'Performance marketers'],
      lookalike: ['Website visitor lookalike', 'Customer list lookalike'],
      remarketing: ['All visitors 30 days', 'Pricing page visitors'],
      linkedin_targeting: {
        job_titles: ['Marketing Manager', 'Growth Lead', 'Founder'],
        industries: ['Software', 'Ecommerce', 'Professional Services'],
        company_sizes: ['11-50', '51-200', '201-500'],
        seniority: ['Manager', 'Director', 'Founder'],
      },
    },
    creatives: {
      creative_angles: [
        'Save planning time',
        'Reduce launch guesswork',
        'Make reporting client-ready',
      ],
      image_concepts: createMockCreatives('image_concept', ['1:1', '4:5']),
      video_scripts: createMockCreatives('video_script', []),
      lead_gen_form_fields: ['Full name', 'Work email', 'Company', 'Monthly ad budget'],
    },
  }
}

export function createMockReport(type: string, project: ProjectLike) {
  const company = getCompany(project)
  const reportLabel = type.replace(/_/g, ' ')

  return `# ${company} ${reportLabel} Report

## Executive Summary
${company} is ready for a focused performance marketing push. This test report summarizes the recommended campaign direction, channel priorities, and next actions using mock data for preview testing.

## Performance Highlights
- Campaign structure is ready for search, social, and remarketing channels.
- Primary audience: ${project.business_analysis?.target_audience || 'high-intent prospects'}.
- Suggested monthly budget: $${getBudget(project).toLocaleString()}.

## Channel Performance Analysis
- Google Search should capture high-intent demand.
- Meta should validate creative angles and retarget engaged visitors.
- LinkedIn can support B2B audience testing when the offer targets decision makers.

## Recommendations
- Start with 2-3 core offers and separate brand, competitor, and pain-point messaging.
- Review landing page friction before scaling spend.
- Track lead quality by channel, not only cost per lead.

## Action Items
- Approve campaign structure.
- Launch first creative test.
- Review early results after 7 days.`
}

export function createMockCreatives(type: string, formats: string[]) {
  if (type === 'copy_variations') {
    return [
      {
        angle: 'Problem-Solution',
        headline: 'Stop guessing your campaign plan',
        body: 'Turn your website and offer into structured campaigns with clearer targeting and messaging.',
        cta: 'Start Planning',
      },
      {
        angle: 'Social Proof',
        headline: 'Build client-ready campaigns faster',
        body: 'Use AI-assisted planning to prepare ad copy, audiences, and reports from one project workspace.',
        cta: 'Create Campaign',
      },
    ]
  }

  if (type === 'video_script') {
    return [
      {
        duration: 15,
        hook: 'Still building campaigns from scratch?',
        voiceover: 'Paste your URL, choose your goal, and get a campaign blueprint ready to review.',
        cta: 'Try it today',
        storyboard_notes: 'Fast dashboard cuts, URL input, campaign cards, final CTA screen.',
      },
      {
        duration: 30,
        hook: 'Your next campaign does not need a two-week planning cycle.',
        voiceover: 'AdPilot turns business analysis, competitor gaps, ad copy, and reports into one workflow for your team.',
        cta: 'Build your plan',
        storyboard_notes: 'Show before/after workflow, team review, export moment.',
      },
    ]
  }

  const selectedFormats = formats.length ? formats : ['1:1', '4:5', '1.91:1']

  return selectedFormats.map((format) => ({
    format,
    concept: 'Clean dashboard-style visual showing campaign insights, channel cards, and a clear growth CTA.',
    headline: 'Launch smarter campaigns',
    body_text: 'Plan, test, and report from one workspace.',
    cta: 'Get Started',
    color_scheme: ['#4f46e5', '#0ea5e9', '#10b981'],
    visual_elements: ['Dashboard cards', 'Growth chart', 'Channel badges'],
    mood: 'Confident and modern',
  }))
}

export function createMockProjectAnalysis(project: ProjectLike) {
  const company = getCompany(project)
  const budget = getBudget(project)

  return {
    businessAnalysis: {
      company_name: company,
      business_category: 'Performance Marketing',
      products: ['Campaign planning workspace', 'AI strategy assistant'],
      services: ['Campaign generation', 'Creative planning', 'Reporting'],
      features: ['Website analysis', 'Competitor research', 'Campaign exports'],
      pricing: 'Subscription-based pricing',
      usp: ['Fast campaign planning', 'Client-ready outputs', 'Multi-channel strategy'],
      target_audience: 'founders, marketers, and agencies running paid campaigns',
      geographic_markets: [project.target_country || 'India'],
      pain_points: ['Slow campaign planning', 'Unclear channel strategy', 'Manual reporting'],
      objections: ['Needs proof before scaling', 'Requires clear ROI visibility'],
      summary: `${company} helps teams move from website research to campaign-ready planning with less manual work.`,
      analyzed_at: new Date().toISOString(),
    },
    competitorAnalysis: {
      competitors: [
        {
          name: 'Manual Agency Workflow',
          website: 'agency-workflow.example',
          positioning: 'Done-for-you planning and execution',
          messaging: 'Expert-led marketing operations',
          offer: 'Retainer-based campaign management',
          strengths: ['Human expertise', 'Custom service'],
          weaknesses: ['Slow turnaround', 'Higher cost'],
          ad_channels: ['Google', 'Meta', 'LinkedIn'],
        },
      ],
      market_positioning: `${company} is positioned as a faster planning layer for campaign teams.`,
      gap_analysis: ['Speed of initial planning', 'Unified reporting workflow', 'Clear test structure'],
      opportunities: ['Launch smaller tests faster', 'Use creative angles per channel', 'Improve reporting consistency'],
      analyzed_at: new Date().toISOString(),
    },
    campaignStrategy: {
      recommended_channels: [
        { platform: 'Google Ads', percentage: 45, budget: budget * 0.45, rationale: 'Capture high-intent demand.' },
        { platform: 'Meta Ads', percentage: 35, budget: budget * 0.35, rationale: 'Validate creative angles and retarget visitors.' },
        { platform: 'LinkedIn Ads', percentage: 20, budget: budget * 0.2, rationale: 'Reach B2B decision makers.' },
      ],
      funnel_strategy: {
        awareness: ['Educational video', 'Problem-aware creatives'],
        consideration: ['Comparison messaging', 'Landing page retargeting'],
        conversion: ['Demo CTA', 'Offer-focused search ads'],
      },
      audience_strategy: 'Start with high-intent users and retarget engaged visitors across channels.',
      key_messages: ['Plan faster', 'Launch with clarity', 'Report with confidence'],
      timeline: 'Run a 14-day validation sprint, then scale winning channels.',
      generated_at: new Date().toISOString(),
    },
    forecasts: {
      estimated_cpc: 1.85,
      estimated_ctr: 3.4,
      estimated_clicks: Math.round(budget / 1.85),
      estimated_leads: Math.max(Math.round(budget / 42), 8),
      estimated_cpl: 42,
      estimated_revenue: Math.round(budget * 3.1),
      estimated_roas: 3.1,
      confidence_score: 72,
      assumptions: ['Mock data for preview testing', 'Actual performance depends on offer and landing page quality'],
      generated_at: new Date().toISOString(),
    },
  }
}
