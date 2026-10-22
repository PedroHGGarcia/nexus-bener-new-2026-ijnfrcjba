import { useState } from 'react'
import { parseTechnicalData, isTechnicalTableJson } from '@/lib/technical-table'
import { isHtmlContent } from '@/lib/technical-html-converter'
import { sanitizeHtml } from '@/lib/escape-html'
import { formatBulletList } from '@/lib/format'
import { VersaoRichText } from '@/lib/versao-rich-text'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ExternalLink } from 'lucide-react'

interface TechnicalDataDisplayProps {
  content: string | null | undefined
  emptyMessage?: string
  className?: string
  compact?: boolean
}

/**
 * Renderiza dados técnicos (especificações técnicas, características construtivas,
 * acessórios standards).
 * Suporta três formatos com total compatibilidade retroativa:
 * 1. Rich HTML formatado com imagens, tabelas e estilos (via RichTextEditor)
 * 2. JSON estruturado de tabela técnica (v0.0.554/555)
 * 3. Texto puro legado ou bullets tradicionais ('•')
 */
export function TechnicalDataDisplay({
  content,
  emptyMessage = 'Nenhuma informação cadastrada.',
  className = '',
  compact = false,
}: TechnicalDataDisplayProps) {
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  if (!content || !content.trim()) {
    return <span className="text-muted-foreground italic text-xs">{emptyMessage}</span>
  }

  // 1. Verifica se é Rich HTML (formatado pelo RichTextEditor)
  if (isHtmlContent(content)) {
    const cleanHtml = sanitizeHtml(content)
    return (
      <div
        className={`rich-text-rendered text-slate-800 dark:text-slate-200 leading-relaxed max-w-none ${
          compact ? 'text-[11px] prose-sm' : 'text-xs sm:text-sm'
        } ${className}`}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    )
  }

  // 2. Verifica se é JSON de tabela estruturada
  if (isTechnicalTableJson(content)) {
    const table = parseTechnicalData(content)
    if (table.rows.length === 0) {
      return <span className="text-muted-foreground italic text-xs">{emptyMessage}</span>
    }

    const hasAnyImage = table.rows.some((r) => Boolean(r.imagem && r.imagem.trim()))

    return (
      <>
        <div
          className={`overflow-x-auto rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {hasAnyImage && (
                  <th className="py-1.5 px-2 font-bold uppercase tracking-wider text-[10px] w-14 text-center">
                    Foto
                  </th>
                )}
                {table.columns.map((col, idx) => (
                  <th
                    key={col.id}
                    className={`py-1.5 px-2.5 font-bold uppercase tracking-wider text-[10px] ${
                      idx === 0 ? 'w-20 text-center' : ''
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {table.rows.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850">
                  {hasAnyImage && (
                    <td className="py-1 px-1.5 text-center align-middle w-14">
                      {row.imagem ? (
                        <button
                          type="button"
                          onClick={() => setZoomImage(row.imagem || null)}
                          title="Clique para ampliar"
                          className="inline-flex h-9 w-11 rounded border border-slate-200 bg-slate-50 p-0.5 overflow-hidden items-center justify-center hover:border-[#0b3c26] transition-colors"
                        >
                          <img
                            src={row.imagem}
                            alt="Foto do item"
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px] select-none">—</span>
                      )}
                    </td>
                  )}
                  {table.columns.map((col, cIdx) => (
                    <td
                      key={col.id}
                      className={`py-1.5 px-2.5 text-slate-800 dark:text-slate-200 ${
                        cIdx === 0
                          ? 'text-center font-medium text-slate-600 dark:text-slate-400'
                          : ''
                      } ${compact ? 'text-[10px]' : 'text-[11px]'}`}
                    >
                      {row.values[col.id] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de Zoom da Imagem */}
        <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-white border">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">Foto do Item Técnico</span>
              {zoomImage && (
                <a
                  href={zoomImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#0b3c26] hover:underline flex items-center gap-1 font-medium mr-6"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir original
                </a>
              )}
            </div>
            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
              {zoomImage && (
                <img
                  src={zoomImage}
                  alt="Foto ampliada do item"
                  className="max-h-[60vh] max-w-full object-contain rounded border bg-white p-1"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // 3. Renderização rica (atende estritamente às regras de <B>, quebras, bullets "•", REGRA 7: espaços internos e [SPn]: alinhamento perfeito de colunas)
  return (
    <div
      className={`leading-relaxed text-slate-800 dark:text-slate-200 font-mono ${className}`}
      style={{
        fontFamily: "'Courier New', Courier, monospace, 'Lucida Console'",
        whiteSpace: 'pre-wrap',
      }}
    >
      <VersaoRichText content={content} emptyMessage={emptyMessage} />
    </div>
  )
}
