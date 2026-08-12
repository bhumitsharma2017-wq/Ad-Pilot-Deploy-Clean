import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import PptxGenJS from 'pptxgenjs'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { getProjectAccess } from '@/lib/project-access'

export const runtime = 'nodejs'
export const maxDuration = 60

type ReportSection = {
  title: string
  items: string[]
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 52

function plainText(value: string) {
  return value
    .replace(/^\s*[-*]\s+/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function toSections(content: string): ReportSection[] {
  const sections: ReportSection[] = []
  let current: ReportSection = { title: 'Executive Summary', items: [] }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^#{1,3}\s+/.test(line)) {
      if (current.items.length) sections.push(current)
      current = { title: plainText(line.replace(/^#{1,3}\s+/, '')) || 'Report Section', items: [] }
      continue
    }

    const text = plainText(line)
    if (text) current.items.push(text)
  }

  if (current.items.length || sections.length === 0) sections.push(current)
  return sections.filter(section => section.title || section.items.length)
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 90) || 'adpilot_report'
}

function renderPdf(title: string, content: string): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const sections = toSections(content)
  let page = 1
  let y = PAGE_MARGIN

  const addPageHeader = () => {
    doc.setFillColor(79, 70, 229)
    doc.rect(0, 0, PAGE_WIDTH, 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('AdPilot AI', PAGE_MARGIN, 22)
    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${page}`, PAGE_WIDTH - PAGE_MARGIN, 22, { align: 'right' })
    doc.setTextColor(31, 41, 55)
  }

  const nextPage = () => {
    doc.addPage()
    page += 1
    y = PAGE_MARGIN
    addPageHeader()
  }

  const writeParagraph = (text: string, options: { bullet?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    const size = options.size || 10.5
    const left = PAGE_MARGIN + (options.bullet ? 14 : 0)
    const maxWidth = PAGE_WIDTH - left - PAGE_MARGIN
    doc.setFontSize(size)
    doc.setTextColor(...(options.color || [75, 85, 99]))
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    const lineHeight = size * 1.45
    if (y + lines.length * lineHeight > PAGE_HEIGHT - PAGE_MARGIN) nextPage()
    if (options.bullet) {
      doc.setFillColor(79, 70, 229)
      doc.circle(PAGE_MARGIN + 4, y - 3.5, 2, 'F')
    }
    doc.text(lines, left, y)
    y += lines.length * lineHeight + 7
  }

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ADPILOT AI', PAGE_MARGIN, 100)
  doc.setFontSize(30)
  const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - PAGE_MARGIN * 2) as string[]
  doc.text(titleLines, PAGE_MARGIN, 175)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(191, 219, 254)
  doc.text('Performance marketing intelligence, ready for action.', PAGE_MARGIN, 270)
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, PAGE_MARGIN, PAGE_HEIGHT - 72)

  doc.addPage()
  addPageHeader()
  y = 72

  for (const section of sections) {
    if (y > PAGE_HEIGHT - 120) nextPage()
    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    const heading = doc.splitTextToSize(section.title, PAGE_WIDTH - PAGE_MARGIN * 2) as string[]
    doc.text(heading, PAGE_MARGIN, y)
    y += heading.length * 20 + 10
    doc.setDrawColor(224, 231, 255)
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y)
    y += 18
    section.items.forEach(item => writeParagraph(item, { bullet: true }))
    y += 12
  }

  const output = doc.output('arraybuffer')
  return new Uint8Array(output)
}

function addPptTitle(slide: ReturnType<PptxGenJS['addSlide']>, title: string, subtitle?: string) {
  slide.background = { color: '0F172A' }
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.22, fill: { color: '4F46E5' }, line: { color: '4F46E5' } })
  slide.addText('ADPILOT AI', { x: 0.7, y: 0.75, w: 3, h: 0.3, fontFace: 'Aptos', fontSize: 12, bold: true, color: 'BFDBFE', charSpacing: 1.5 })
  slide.addText(title, { x: 0.7, y: 1.45, w: 11.6, h: 2, fontFace: 'Aptos Display', fontSize: 29, bold: true, color: 'FFFFFF', breakLine: false, fit: 'shrink' })
  if (subtitle) {
    slide.addText(subtitle, { x: 0.7, y: 3.8, w: 9.5, h: 0.55, fontFace: 'Aptos', fontSize: 14, color: 'CBD5E1', fit: 'shrink' })
  }
  slide.addText(`Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, { x: 0.7, y: 6.7, w: 4.5, h: 0.25, fontFace: 'Aptos', fontSize: 9, color: '94A3B8' })
}

async function renderPptx(title: string, content: string): Promise<Uint8Array> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'AdPilot AI'
  pptx.company = 'AdPilot AI'
  pptx.subject = 'Performance marketing report'
  pptx.title = title
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  }

  const cover = pptx.addSlide()
  addPptTitle(cover, title, 'Performance marketing intelligence, ready for action.')

  const sections = toSections(content)
  let slideNumber = 2
  for (const section of sections) {
    const chunks: string[][] = []
    for (let index = 0; index < section.items.length; index += 6) chunks.push(section.items.slice(index, index + 6))
    if (!chunks.length) chunks.push([])

    for (const [index, items] of chunks.entries()) {
      const slide = pptx.addSlide()
      slide.background = { color: 'FFFFFF' }
      slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: '4F46E5' }, line: { color: '4F46E5' } })
      slide.addText(index ? `${section.title} (cont.)` : section.title, { x: 0.7, y: 0.55, w: 11.8, h: 0.55, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: '111827', fit: 'shrink' })
      slide.addShape('line', { x: 0.7, y: 1.33, w: 11.9, h: 0, line: { color: 'E0E7FF', width: 1 } })
      const bulletText = items.map(item => ({ text: item, options: { bullet: { indent: 16 }, hanging: 4, breakLine: true } }))
      if (bulletText.length) {
        slide.addText(bulletText, { x: 0.9, y: 1.7, w: 11.2, h: 4.6, fontFace: 'Aptos', fontSize: 16, color: '374151', breakLine: false, paraSpaceAfter: 12, fit: 'shrink', valign: 'top', margin: 0 })
      } else {
        slide.addText('No additional findings were available for this section.', { x: 0.9, y: 1.7, w: 11.2, h: 0.4, fontFace: 'Aptos', fontSize: 16, color: '6B7280' })
      }
      slide.addText('AdPilot AI', { x: 0.7, y: 7.06, w: 2, h: 0.18, fontFace: 'Aptos', fontSize: 8, color: '9CA3AF' })
      slide.addText(`${slideNumber}`, { x: 12.1, y: 7.06, w: 0.45, h: 0.18, align: 'right', fontFace: 'Aptos', fontSize: 8, color: '9CA3AF' })
      slideNumber += 1
    }
  }

  const output = await pptx.write({ outputType: 'arraybuffer' })
  return new Uint8Array(output as ArrayBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')
    const format = searchParams.get('format') || 'pdf'
    if (!reportId) return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    if (!['pdf', 'ppt', 'pptx'].includes(format)) return NextResponse.json({ error: 'Invalid format' }, { status: 400 })

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: report, error } = await adminClient
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const { project } = await getProjectAccess(adminClient, user.id, report.project_id)
    if (!project) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const content = String((report.content as Record<string, unknown>)?.text || '')
    if (!content.trim()) return NextResponse.json({ error: 'This report has no content to export' }, { status: 422 })

    const filename = safeFilename(report.title)
    if (format === 'pdf') {
      const pdf = renderPdf(report.title, content)
      return new NextResponse(Uint8Array.from(pdf).buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const pptx = await renderPptx(report.title, content)
    return new NextResponse(Uint8Array.from(pptx).buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}.pptx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Report export error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Report export failed' }, { status: 500 })
  }
}
