import { PropostaWithRelations } from '@/types/proposta'
import { formatCurrencyByMoeda, formatBulletList } from '@/lib/format'
import { formatPrecoEspecialDiscountBadge } from '@/lib/proposta-calculations'
import benerHeaderLogo from '@/assets/image-f448b.png'

interface CompVersion {
  nome?: string
  valor?: number
  especificacoes?: string
}

export function PropostaCleanHeader({
  numero,
  revisao,
  data,
}: {
  numero: string | null
  revisao: string | null
  data: string | null
}) {
  return (
    <header className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex items-center gap-2">
        <img
          src={benerHeaderLogo}
          alt="BENER - MÁQUINAS QUE TRANSFORMAM"
          className="h-12 w-auto object-contain max-w-[240px]"
        />
      </div>
      <div className="text-right">
        <h2 className="text-lg font-bold text-slate-800">{numero || '—'}</h2>
        {revisao && <p className="text-xs text-slate-500">Revisão: {revisao}</p>}
        <p className="text-xs text-slate-500">Data: {data || '—'}</p>
      </div>
    </header>
  )
}

export function PropostaCleanClient({ cliente }: { cliente: PropostaWithRelations['clientes'] }) {
  return (
    <section className="mb-5">
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
        Dados do Cliente
      </h3>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <p>
          <strong>Razão Social:</strong> {cliente?.razao_social || cliente?.fantasia || '—'}
        </p>
        <p>
          <strong>Documento:</strong> {cliente?.documento || '—'}
        </p>
        <p>
          <strong>Contato:</strong> {cliente?.contato || '—'}
        </p>
        <p>
          <strong>Email:</strong> {cliente?.email || '—'}
        </p>
        <p>
          <strong>Telefone:</strong> {cliente?.telefone || '—'}
        </p>
        <p>
          <strong>Endereço:</strong>{' '}
          {[cliente?.logradouro, cliente?.numero, cliente?.bairro, cliente?.cidade, cliente?.estado]
            .filter(Boolean)
            .join(', ') || '—'}
        </p>
      </div>
    </section>
  )
}

export function PropostaCleanSpecs({
  versao,
  especificacoes,
}: {
  versao: PropostaWithRelations['versoes']
  especificacoes?: string | null
}) {
  const versaoData = versao as {
    nome?: string
    especificacoes_tecnicas?: string | null
    acessorios_standards?: string | null
    caracteristicas_construtivas?: string | null
  } | null

  const specsText = versaoData?.especificacoes_tecnicas || especificacoes
  const acessoriosText = versaoData?.acessorios_standards || versao?.acessorios_standards
  const construtivasText =
    versaoData?.caracteristicas_construtivas || versao?.caracteristicas_construtivas

  return (
    <section className="mb-5">
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
        Equipamento
      </h3>
      <p className="text-xs font-semibold mb-1">{versao?.nome || '—'}</p>
      {specsText && (
        <div className="text-xs text-slate-600 whitespace-pre-wrap">
          <strong>Especificações:</strong>
          <p>{formatBulletList(specsText)}</p>
        </div>
      )}
      {acessoriosText && (
        <div className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
          <strong>Configuração Standards:</strong>
          <p>{formatBulletList(acessoriosText)}</p>
        </div>
      )}
      {construtivasText && (
        <div className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
          <strong>Características Construtivas:</strong>
          <p>{formatBulletList(construtivasText)}</p>
        </div>
      )}
    </section>
  )
}

export function PropostaCleanPricing({ proposal }: { proposal: PropostaWithRelations }) {
  const rawValorSemDesc =
    proposal.valor_sem_desconto != null && Number(proposal.valor_sem_desconto) > 0
      ? Number(proposal.valor_sem_desconto)
      : Number(proposal.valor_final || 0)
  const rawValorFinal = Number(proposal.valor_final || 0)
  const rawPrecoEspecial =
    proposal.preco_especial != null && Number(proposal.preco_especial) > 0
      ? Number(proposal.preco_especial)
      : null
  const percentualDesc = Number(proposal.percentual_desconto || 0)

  // Point 1: Rule for strikethrough original table price
  const hasItemDiscount =
    percentualDesc > 0 ||
    (rawPrecoEspecial != null && rawPrecoEspecial > 0) ||
    rawValorSemDesc > rawValorFinal
  const valorOriginalTabela =
    rawValorSemDesc > 0
      ? rawValorSemDesc
      : rawValorFinal > 0
        ? rawValorFinal
        : rawPrecoEspecial || 0
  const valorEfetivoFinal =
    rawPrecoEspecial != null && rawPrecoEspecial > 0 ? rawPrecoEspecial : rawValorFinal
  const valorUnitarioEfetivo = rawValorFinal > 0 ? rawValorFinal : valorEfetivoFinal
  const effectiveDiscountPercent =
    percentualDesc > 0
      ? percentualDesc
      : rawPrecoEspecial != null &&
          rawPrecoEspecial > 0 &&
          valorOriginalTabela > 0 &&
          rawPrecoEspecial < valorOriginalTabela
        ? Math.round(((valorOriginalTabela - rawPrecoEspecial) / valorOriginalTabela) * 100 * 10) /
          10
        : 0

  const terms: Array<[string, string | null | undefined]> = [
    ['Condições de Pagamento', proposal.condicoes_pagamento],
    ['Prazo de Entrega', proposal.prazo_entrega],
    ['Validade da Oferta', proposal.validade_oferta],
    ['Cobertura de Garantia', proposal.cobertura_garantia],
    ['Garantia de Acessórios', proposal.garantia_acessorios],
    ['Normas Aplicáveis', proposal.normas_aplicaveis],
    ['Assistência Técnica', proposal.assistencia_tecnica_detalhada],
    ['Transporte/Seguro', proposal.transporte_seguro],
    ['Certificações', proposal.certificacoes],
  ].filter(([, v]) => v) as Array<[string, string]>
  return (
    <>
      <section className="mb-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          Condições Comerciais
        </h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="p-2 text-left border border-slate-200">Descrição</th>
              <th className="p-2 text-right border border-slate-200">Valor Sem Desc.</th>
              <th className="p-2 text-right border border-slate-200">Desc.</th>
              <th className="p-2 text-right border border-slate-200">Valor Final</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-200 font-medium">
                {proposal.versoes?.nome || 'Equipamento'}
              </td>
              <td className="p-2 border border-slate-200 text-right">
                {hasItemDiscount ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="line-through text-slate-400 font-semibold text-[11px]">
                      {formatCurrencyByMoeda(valorOriginalTabela, proposal.moeda)}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrencyByMoeda(valorUnitarioEfetivo, proposal.moeda)}
                    </span>
                  </div>
                ) : (
                  formatCurrencyByMoeda(valorOriginalTabela, proposal.moeda)
                )}
              </td>
              <td className="p-2 border border-slate-200 text-right">
                {effectiveDiscountPercent}%
              </td>
              <td className="p-2 border border-slate-200 text-right font-bold">
                {hasItemDiscount ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="line-through text-slate-400 font-semibold text-[11px]">
                      {formatCurrencyByMoeda(valorOriginalTabela, proposal.moeda)}
                    </span>
                    <span className="font-bold text-[#0b3c26]">
                      {formatCurrencyByMoeda(valorEfetivoFinal, proposal.moeda)}
                    </span>
                  </div>
                ) : (
                  formatCurrencyByMoeda(valorEfetivoFinal, proposal.moeda)
                )}
              </td>
            </tr>
          </tbody>
          {proposal.preco_especial != null && Number(proposal.preco_especial) > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td colSpan={3} className="p-2 text-right border border-slate-200">
                  VALOR TOTAL DO FORNECIMENTO:
                </td>
                <td className="p-2 border border-slate-200 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="line-through text-slate-400 font-semibold text-[11px]">
                      {formatCurrencyByMoeda(proposal.valor_final, proposal.moeda)}
                    </span>
                    <span className="font-bold text-[#0b3c26] text-sm">
                      {formatCurrencyByMoeda(proposal.preco_especial, proposal.moeda)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] uppercase font-bold text-[#0b3c26]">
                        Preço Especial
                      </span>
                      {formatPrecoEspecialDiscountBadge(
                        proposal.valor_final,
                        proposal.preco_especial,
                      ) && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#0b3c26]/10 text-[#0b3c26] border border-[#0b3c26]/20">
                          {formatPrecoEspecialDiscountBadge(
                            proposal.valor_final,
                            proposal.preco_especial,
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
      <section className="mb-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          Termos e Condições
        </h3>
        <div className="space-y-1">
          {terms.map(([label, value]) => (
            <p key={label} className="text-xs text-slate-600">
              <strong className="text-slate-700">{label}:</strong> {value}
            </p>
          ))}
        </div>
      </section>
    </>
  )
}

export function PropostaCleanSignatures({ proposal }: { proposal: PropostaWithRelations }) {
  const sigs = [
    {
      title: 'Gerente de Produto',
      name: proposal.nome_gerente_produto,
      sig: proposal.assinatura_gerente_produto,
    },
    {
      title: 'Assessor Técnico',
      name: proposal.nome_assessor_tecnico,
      sig: proposal.assinatura_assessor_tecnico,
    },
    {
      title: 'Representante Comercial',
      name: proposal.nome_representante_comercial,
      sig: proposal.assinatura_representante,
    },
  ]
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 border-b border-slate-200 pb-1">
        Assinaturas
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        {sigs.map((s) => (
          <div key={s.title} className="flex flex-col items-center">
            {s.sig ? (
              <img
                src={s.sig}
                alt={s.title}
                className="h-14 object-contain"
                loading="lazy"
                width={120}
                height={56}
              />
            ) : (
              <div className="h-14" />
            )}
            <div className="border-t border-slate-800 w-full pt-1 mt-2">
              <p className="font-semibold text-slate-800 text-xs">{s.name || '—'}</p>
              <p className="text-slate-500 text-xs">{s.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function PropostaCleanDocument({ proposal }: { proposal: PropostaWithRelations }) {
  return (
    <div className="bg-white text-slate-900 mx-auto p-8" style={{ maxWidth: '210mm' }}>
      <PropostaCleanHeader
        numero={proposal.numero_proposta}
        revisao={proposal.revisao}
        data={proposal.dt_cad}
      />
      <PropostaCleanClient cliente={proposal.clientes} />
      <PropostaCleanSpecs
        versao={proposal.versoes}
        especificacoes={proposal.especificacoes_tecnicas}
      />
      <PropostaCleanPricing proposal={proposal} />
      <section className="my-6 text-xs text-slate-800 break-inside-avoid">
        <p className="text-justify leading-relaxed">
          Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso inteiro
          dispor, para dirimir e atender quaisquer eventuais esclarecimentos adicionais que se
          fizerem necessários.
        </p>
        <p className="mt-3 text-left">Atenciosamente</p>
      </section>
      <PropostaCleanSignatures proposal={proposal} />
    </div>
  )
}
