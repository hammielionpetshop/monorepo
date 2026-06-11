import { promises as fs } from 'fs'
import path from 'path'

interface ParsedBlock {
  type: 'version' | 'section' | 'item' | 'spacer'
  content: string
  meta?: string // date for version blocks
}

function parseInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs font-mono">$1</code>')
}

function parseChangelog(md: string): ParsedBlock[] {
  const lines = md.split('\n')
  const blocks: ParsedBlock[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()

    // ## [1.1.0] - 2026-06-07
    const versionMatch = line.match(/^##\s+\[(.+?)\]\s*-\s*(.+)$/)
    if (versionMatch) {
      blocks.push({ type: 'version', content: versionMatch[1], meta: versionMatch[2].trim() })
      continue
    }

    // ### Added / Fixed / Changed
    const sectionMatch = line.match(/^###\s+(.+)$/)
    if (sectionMatch) {
      blocks.push({ type: 'section', content: sectionMatch[1] })
      continue
    }

    // - list item
    const itemMatch = line.match(/^-\s+(.+)$/)
    if (itemMatch) {
      blocks.push({ type: 'item', content: itemMatch[1] })
      continue
    }

    // horizontal rule or empty
    if (line === '---' || line.trim() === '') {
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'spacer') {
        blocks.push({ type: 'spacer', content: '' })
      }
      continue
    }
  }

  return blocks
}

const SECTION_COLORS: Record<string, string> = {
  Added: 'text-green-700 bg-green-500/10 border-green-500/20',
  Fixed: 'text-red-700 bg-red-500/10 border-red-500/20',
  Changed: 'text-blue-700 bg-blue-500/10 border-blue-500/20',
  Removed: 'text-orange-700 bg-orange-500/10 border-orange-500/20',
}

export default async function ChangelogPage() {
  const filePath = path.join(process.cwd(), 'CHANGELOG.md')
  const raw = await fs.readFile(filePath, 'utf-8')
  const blocks = parseChangelog(raw)

  // Group blocks into versions
  type VersionGroup = {
    version: string
    date: string
    sections: { name: string; items: string[] }[]
    currentSection: string | null
  }

  const versions: VersionGroup[] = []
  let current: VersionGroup | null = null

  for (const block of blocks) {
    if (block.type === 'version') {
      current = { version: block.content, date: block.meta ?? '', sections: [], currentSection: null }
      versions.push(current)
    } else if (block.type === 'section' && current) {
      current.sections.push({ name: block.content, items: [] })
      current.currentSection = block.content
    } else if (block.type === 'item' && current) {
      const lastSection = current.sections[current.sections.length - 1]
      if (lastSection) lastSection.items.push(block.content)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Changelog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riwayat perubahan dan pembaruan sistem Hammielion Backoffice
        </p>
      </div>

      <div className="space-y-8">
        {versions.map((v) => (
          <div key={v.version} className="relative">
            {/* Version header */}
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-lg font-bold text-foreground">v{v.version}</h2>
              <span className="text-sm text-muted-foreground">{v.date}</span>
            </div>

            {/* Sections */}
            <div className="space-y-4 pl-4 border-l-2 border-border">
              {v.sections.map((section) => {
                const colorClass = SECTION_COLORS[section.name] ?? 'text-muted-foreground bg-muted border-border'
                return (
                  <div key={section.name}>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-md border mb-2 ${colorClass}`}
                    >
                      {section.name}
                    </span>
                    <ul className="space-y-1.5">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <span dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
