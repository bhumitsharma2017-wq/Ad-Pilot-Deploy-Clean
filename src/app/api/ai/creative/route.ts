import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { createMockCreatives } from '@/lib/ai/mock-data'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { hasServerRequiredPlan, shouldUseMockAi } from '@/lib/subscription/test-mode'
import { canEditProject, getProjectAccess } from '@/lib/project-access'

export const runtime = 'nodejs'
export const maxDuration = 60

const VALID_FORMATS = ['1:1', '4:5', '1.91:1', '9:16'] as const
type CreativeFormat = (typeof VALID_FORMATS)[number]

type ImageConcept = {
  format: CreativeFormat
  concept: string
  headline: string
  body_text: string
  cta: string
  color_scheme: string[]
  visual_elements: string[]
  mood: string
  image_data_url?: string
}

type SavedCreativeAsset = {
  id: string
  type: 'image' | 'copy' | 'video_script' | 'storyboard'
  format: string | null
  title: string | null
  content: Record<string, unknown>
  public_url: string | null
  created_at: string
}

let openaiClient: OpenAI | null = null

function getOpenAIClient() {
  if (openaiClient) return openaiClient

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')

  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('AI returned an invalid response')
  }
  return parsed as Record<string, unknown>
}

function asText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return (text || fallback).slice(0, maxLength)
}

function asColorScheme(value: unknown) {
  const colors = Array.isArray(value)
    ? value.filter((color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
    : []
  return colors.length >= 2 ? colors.slice(0, 3) : ['#0f172a', '#2563eb', '#f59e0b']
}

function asTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5)
  return items.length ? items : fallback
}

function normalizeImageConcept(value: unknown, format: CreativeFormat): ImageConcept {
  const concept = value && typeof value === 'object' ? value as Record<string, unknown> : {}

  return {
    format,
    concept: asText(concept.concept, 'A product-led ad scene that makes the offer immediately clear.', 500),
    headline: asText(concept.headline, 'See the difference', 60),
    body_text: asText(concept.body_text, 'Built around a clear customer benefit.', 120),
    cta: asText(concept.cta, 'Learn More', 30),
    color_scheme: asColorScheme(concept.color_scheme),
    visual_elements: asTextList(concept.visual_elements, ['Product or service in use', 'Clear customer outcome']),
    mood: asText(concept.mood, 'Polished and trustworthy', 80),
  }
}

function imageSizeFor(format: CreativeFormat): '1024x1024' | '1024x1536' | '1536x1024' {
  if (format === '1:1') return '1024x1024'
  if (format === '1.91:1') return '1536x1024'
  return '1024x1536'
}

function businessBrief(business: Record<string, unknown>) {
  const list = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(' | ')
    : ''

  return `Company: ${String(business.company_name || '')}
Category: ${String(business.business_category || '')}
Products: ${list(business.products)}
Services: ${list(business.services)}
Features: ${list(business.features)}
Verified USPs: ${list(business.usp)}
Target audience: ${String(business.target_audience || '')}
Customer pain points: ${list(business.pain_points)}`
}

async function generateImageConcepts(
  business: Record<string, unknown>,
  formats: CreativeFormat[]
): Promise<ImageConcept[]> {
  const response = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.45,
    max_tokens: 2200,
    messages: [{
      role: 'user',
      content: `You are a senior art director creating paid social and display ads.

SOURCE OF TRUTH — use only these business facts. Never substitute a generic SaaS, marketing, dashboard, or unrelated business.
${businessBrief(business)}

Create one strong, product-led visual direction for each requested format: ${formats.join(', ')}.
The concept must visibly communicate the actual offer, customer context, and one verified USP. It must not be a coloured background with a line of text.

Return JSON exactly in this shape:
{
  "concepts": [
    {
      "format": "1:1",
      "concept": "Specific scene, subject, composition, product/service evidence, and background. It should be usable by an image generator without further interpretation.",
      "headline": "Specific headline, max 8 words",
      "body_text": "Specific supporting message, max 15 words",
      "cta": "Appropriate CTA",
      "color_scheme": ["#0f172a", "#2563eb", "#f59e0b"],
      "visual_elements": ["specific element", "specific element"],
      "mood": "specific art direction"
    }
  ]
}

Use exactly ${formats.length} concepts in the same order as the requested formats. Copy must be specific, credible, and aligned with the source of truth. Do not invent discounts, metrics, testimonials, certifications, prices, product names, or features.`
    }],
  })

  const payload = parseJsonObject(response.choices[0].message.content || '{}')
  const rawConcepts = Array.isArray(payload.concepts) ? payload.concepts : []
  if (rawConcepts.length !== formats.length) {
    throw new Error('AI did not create every requested creative format')
  }

  return formats.map((format, index) => normalizeImageConcept(rawConcepts[index], format))
}

async function renderCreativeImage(concept: ImageConcept, business: Record<string, unknown>) {
  const imageResponse = await getOpenAIClient().images.generate({
    // gpt-image-1 is supported by the current SDK; deployments can override it
    // with a newer image model through OPENAI_IMAGE_MODEL.
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    size: imageSizeFor(concept.format),
    quality: 'medium',
    output_format: 'jpeg',
    output_compression: 82,
    background: 'opaque',
    prompt: `Use case: ads-marketing
Asset type: ${concept.format} paid social or display creative background
Business source of truth: ${businessBrief(business)}
Primary request: ${concept.concept}
Visual elements: ${concept.visual_elements.join('; ')}
Style/medium: premium editorial commercial photography or polished campaign illustration, whichever best fits the actual offer
Composition/framing: ${concept.format} aspect ratio, strong focal subject, layered depth, intentional crop, and a clean darker or quieter area for HTML copy overlay
Lighting/mood: ${concept.mood}
Color palette: ${concept.color_scheme.join(', ')} used naturally in the scene
Constraints: the image must visibly show the real product, service context, or customer outcome described above. It must feel like an intentional professional ad creative, with real detail, subject matter, texture, and composition.
Avoid: blank or plain background, gradient-only art, text-only poster, dashboard screenshot, generic office team, unrelated industry, text, letters, logos, watermarks, UI panels, fake claims, distorted people or products.`
  })

  const base64 = imageResponse.data?.[0]?.b64_json
  if (!base64) throw new Error('Image generation returned no image data')
  return `data:image/jpeg;base64,${base64}`
}

async function storeCreativeImage(params: {
  adminClient: ReturnType<typeof createAdminClient>
  userId: string
  projectId: string
  imageDataUrl: string
}) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(params.imageDataUrl)
  if (!match) throw new Error('Generated image data is invalid')

  const mimeType = match[1].toLowerCase()
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const path = `${params.userId}/${params.projectId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`
  const bytes = Buffer.from(match[2], 'base64')
  const { error: uploadError } = await params.adminClient.storage
    .from('creative-assets')
    .upload(path, bytes, { contentType: mimeType, cacheControl: '31536000', upsert: false })
  if (uploadError) {
    throw new Error(`Could not save generated image: ${uploadError.message}`)
  }

  const { data } = params.adminClient.storage.from('creative-assets').getPublicUrl(path)
  return { storagePath: path, publicUrl: data.publicUrl }
}

export async function GET(request: NextRequest) {
  try {
    const projectId = new URL(request.url).searchParams.get('project_id')
    if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 })

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { project } = await getProjectAccess(adminClient, user.id, projectId)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data, error } = await adminClient
      .from('creative_assets')
      .select('id, type, format, title, content, public_url, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(48)
    if (error) throw new Error(error.message)
    return NextResponse.json({ assets: (data || []) as SavedCreativeAsset[] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Creative asset list error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load creative assets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const project_id = typeof body.project_id === 'string' ? body.project_id : ''
    const type = typeof body.type === 'string' ? body.type : ''
    const requestedFormats = Array.isArray(body.formats)
      ? body.formats.filter((format: unknown): format is CreativeFormat =>
        typeof format === 'string' && VALID_FORMATS.includes(format as CreativeFormat)
      )
      : []
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value

    if (!project_id || !['image_concept', 'copy_variations', 'video_script'].includes(type)) {
      return NextResponse.json({ error: 'Invalid creative request' }, { status: 400 })
    }
    if (type === 'image_concept' && requestedFormats.length === 0) {
      return NextResponse.json({ error: 'Select at least one ad format' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { project, permission } = await getProjectAccess(adminClient, user.id, project_id)
    if (!project || !canEditProject(permission)) {
      return NextResponse.json({ error: 'Project not found or you do not have creative access' }, { status: 404 })
    }

    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('plan')
      .eq('user_id', project.user_id)
      .single()
    if (!hasServerRequiredPlan(sub?.plan, 'pro', previewCookie)) {
      return NextResponse.json({ error: 'This workspace needs a Pro or Agency subscription for Creative Studio' }, { status: 403 })
    }

    if (!project.business_analysis) {
      return NextResponse.json({ error: 'Run analysis first' }, { status: 400 })
    }

    const business = project.business_analysis as unknown as Record<string, unknown>
    const mockAi = shouldUseMockAi()
    let creatives: Record<string, unknown>[] = []

    if (mockAi) {
      creatives = createMockCreatives(type, requestedFormats, project) as Record<string, unknown>[]
    } else if (type === 'image_concept') {
      const concepts = await generateImageConcepts(business, requestedFormats)
      creatives = await Promise.all(concepts.map(async concept => ({
        ...concept,
        image_data_url: await renderCreativeImage(concept, business),
      })))
    } else if (type === 'copy_variations') {
      const response = await getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.55,
        max_tokens: 2200,
        messages: [{
          role: 'user',
          content: `Write six high-quality paid-ad copy variations for this exact business.

SOURCE OF TRUTH — do not invent a different company, industry, offer, claim, product, or result:
${businessBrief(business)}

Return JSON: {"variations":[{"angle":"Problem-Solution","headline":"max 10 words","body":"2–3 specific, credible sentences","cta":"clear CTA"}]}.
Use these six angles exactly once: Problem-Solution, Product-in-Use, Direct Benefit, Objection Handling, Social Proof Without Invented Metrics, and Storytelling. Each variation must name or clearly describe the actual offer; generic growth, dashboard, marketing, or AI copy is unacceptable unless that is the verified product.`
        }],
      })
      const payload = parseJsonObject(response.choices[0].message.content || '{}')
      creatives = Array.isArray(payload.variations) ? payload.variations as Record<string, unknown>[] : []
    } else {
      const response = await getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Create 15, 30, and 60 second video ad scripts for this exact business.

SOURCE OF TRUTH — do not invent a different business, offer, feature, result, or audience:
${businessBrief(business)}

Return JSON: {"scripts":[{"duration":15,"hook":"specific first 3 seconds","voiceover":"complete script","cta":"clear CTA","storyboard_notes":"specific scenes and product/service proof"}]}. Create exactly three scripts for durations 15, 30, and 60. Every visual and spoken line must make the real product or service recognizable, not a generic marketing video.`
        }],
      })
      const payload = parseJsonObject(response.choices[0].message.content || '{}')
      creatives = Array.isArray(payload.scripts) ? payload.scripts as Record<string, unknown>[] : []
    }

    if (creatives.length === 0) throw new Error('AI returned no creative assets')

    const imageStorage = new Map<number, { storagePath: string; publicUrl: string }>()
    if (!mockAi && type === 'image_concept') {
      for (const [index, creative] of creatives.entries()) {
        const imageDataUrl = creative.image_data_url
        if (typeof imageDataUrl !== 'string') throw new Error('Generated creative is missing its image')
        imageStorage.set(index, await storeCreativeImage({
          adminClient,
          userId: project.user_id,
          projectId: project_id,
          imageDataUrl,
        }))
      }
    }

    const { data: savedAssets, error: assetError } = await adminClient.from('creative_assets').insert(
      creatives.map((creative, index) => {
        // Base64 previews are returned to the current user but are not stored in
        // JSONB. This keeps database rows lean and avoids a request-size failure.
        const { image_data_url: _preview, ...content } = creative
        const storedImage = imageStorage.get(index)
        if (storedImage) content.image_url = storedImage.publicUrl
        return {
          project_id,
          user_id: project.user_id,
          type: type === 'image_concept' ? 'image' : type === 'video_script' ? 'video_script' : 'copy',
          format: typeof creative.format === 'string' ? creative.format : null,
          content,
          title: `${String(business.company_name || project.name)} - ${type} - ${new Date().toISOString().split('T')[0]}`,
          storage_path: storedImage?.storagePath || null,
          public_url: storedImage?.publicUrl || null,
        }
      })
    ).select('id, type, format, title, content, public_url, created_at')
    if (assetError) throw new Error(assetError.message)

    const responseCreatives = creatives.map((creative, index) => {
      const saved = savedAssets?.[index]
      const storedImage = imageStorage.get(index)
      const { image_data_url: _preview, ...content } = creative
      return {
        ...content,
        id: saved?.id,
        image_url: storedImage?.publicUrl || (content.image_url as string | undefined),
        // In-memory preview keeps the UI responsive immediately after generation,
        // while image_url makes it durable after the user refreshes.
        image_data_url: _preview,
      }
    })

    return NextResponse.json({
      success: true,
      creatives: responseCreatives,
      preview_only: mockAi,
      message: mockAi ? 'Preview concepts shown. Add OPENAI_API_KEY for real AI copy and rendered images.' : undefined,
    })
  } catch (error) {
    console.error('Creative generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Creative generation failed' }, { status: 500 })
  }
}
