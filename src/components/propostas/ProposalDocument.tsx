import { useState, useEffect, useMemo } from 'react'
import { PropostaWithRelations } from '@/types/proposta'
import { PropostaVersaoWithRelations } from '@/types/proposta-versao'
import { TipoProposta } from '@/types/tipo-proposta'
import { fetchPropostaVersoes } from '@/services/proposta-versoes'
import { snapshotToPropostaVersoes } from '@/lib/proposal-snapshot'
import type { CustomField } from '@/components/propostas/CustomFieldsEditor'
import { supabase } from '@/lib/supabase/client'
import { formatCurrencyByMoeda, formatBulletList, normalizeMoedaCode } from '@/lib/format'
import { calcComissaoServicosBener } from '@/lib/proposta-calculations'
import {
  splitIntoParagraphs,
  parseParagraphs,
  stripBoldMarkers,
  isTaxValueEmpty,
  isCommercialFieldEmpty,
} from '@/lib/paragraphs'
import { TechnicalDataDisplay } from '@/components/produtos/TechnicalDataDisplay'
import { resolveDescricaoFontSizeScreen } from '@/lib/descricao-tamanho'
import { ProposalSectionCounter } from '@/lib/proposal-section-numbering'
import benerLogo from '@/assets/image-f448b.png'

interface Props {
  proposal: PropostaWithRelations
}

interface CompVersion {
  nome?: string
  especificacoes?: string
  valor?: number
}

function fmtCurrency(val: number | null | undefined, moeda?: string | null): string {
  if (val == null || isNaN(Number(val))) return '—'
  return formatCurrencyByMoeda(Number(val), normalizeMoedaCode(moeda || 'BRL'))
}

function renderMultilinhaParagraphs(raw: unknown) {
  if (raw == null) return null
  const str = String(raw).trim()
  if (!str) return null
  const paragraphs = splitIntoParagraphs(str)
  if (paragraphs.length <= 1) {
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-[13px] text-justify font-normal">
        {str}
      </p>
    )
  }
  return (
    <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-justify font-normal">
      {paragraphs.map((p, idx) => (
        <p key={idx} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  )
}

function SignatureBlock({
  title,
  name,
  signature,
}: {
  title: string
  name?: string | null
  signature?: string | null
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-16 w-full flex items-end justify-center mb-1">
        {signature ? (
          <img src={signature} alt={title} className="max-h-14 max-w-full object-contain" />
        ) : (
          <div className="w-40 border-b border-black/40" />
        )}
      </div>
      <p className="font-bold text-[11px] text-black leading-tight">{title}</p>
      <p className="text-[10px] text-black/70 leading-tight">{name || '—'}</p>
    </div>
  )
}

export function ProposalDocument({ proposal }: Props) {
  return (
    <div className="p-8 text-black">
      <h1 className="text-xl font-bold">Proposta {proposal.numero_proposta}</h1>
    </div>
  )
}
