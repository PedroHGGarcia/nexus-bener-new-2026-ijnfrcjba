import { useState, useEffect } from 'react'
import { PropostaWithRelations } from '@/types/proposta'
import { PropostaVersaoWithRelations } from '@/types/proposta-versao'
import { fetchPropostaVersoes } from '@/services/proposta-versoes'
import { formatCurrencyByMoeda } from '@/lib/format'
import { calculateLineTotal } from '@/lib/proposta-calculations'
import { TechnicalDataDisplay } from '@/components/produtos/TechnicalDataDisplay'

interface Props {
  proposal: PropostaWithRelations
}

export function EquipmentDetailsSection({ proposal }: Props) {
  const [equipmentItems, setEquipmentItems] = useState<PropostaVersaoWithRelations[]>([])

  useEffect(() => {
    fetchPropostaVersoes(proposal.id)
      .then(setEquipmentItems)
      .catch(() => {})
  }, [proposal.id])

  if (equipmentItems.length === 0) {
    return (
      <section className="mb-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          Detalhamento de Equipamentos
        </h3>
        <p className="text-xs text-slate-400 italic">
          Nenhum equipamento detalhado nesta proposta.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-5">
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
        Detalhamento de Equipamentos
      </h3>
      <div className="space-y-4">
        {equipmentItems.map((item, idx) => {
          const v = item.versoes
          const modelo = v?.modelos
          const marca = modelo?.marcas
          const produto = modelo?.produtos
          const categoria = produto?.categorias_produtos
          const itemTotal = calculateLineTotal({
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            desconto_percentual: item.desconto_percentual ?? undefined,
            desconto_valor: item.desconto_valor ?? undefined,
          })
          const moeda = v?.moeda || proposal.moeda || 'BRL'

          return (
            <div key={item.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                {v?.imagem_preview && (
                  <img
                    src={v.imagem_preview}
                    alt={v.nome}
                    className="w-20 h-20 object-cover rounded border border-slate-200 shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    {idx + 1}. {v?.nome || '—'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-600">
                    {v?.cod_erp && (
                      <p>
                        <strong>Cód. ERP:</strong> {v.cod_erp}
                      </p>
                    )}
                    {v?.nome_abreviado && (
                      <p>
                        <strong>Nome Abrev.:</strong> {v.nome_abreviado}
                      </p>
                    )}
                    {marca && (
                      <p>
                        <strong>Marca:</strong> {marca.nome}
                      </p>
                    )}
                    {modelo && (
                      <p>
                        <strong>Modelo:</strong> {modelo.nome}
                      </p>
                    )}
                    {produto && (
                      <p>
                        <strong>Produto:</strong> {produto.nome}
                      </p>
                    )}
                    {categoria && (
                      <p>
                        <strong>Categoria:</strong> {categoria.nome}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {v?.especificacoes_tecnicas && (
                <div className="mt-2 text-xs text-slate-700">
                  <strong className="block mb-1">Especificações Técnicas:</strong>
                  <TechnicalDataDisplay content={v.especificacoes_tecnicas} compact />
                </div>
              )}
              {v?.caracteristicas_construtivas && (
                <div className="mt-2 text-xs text-slate-700">
                  <strong className="block mb-1">Características Construtivas:</strong>
                  <TechnicalDataDisplay content={v.caracteristicas_construtivas} compact />
                </div>
              )}
              {v?.acessorios_standards && (
                <div className="mt-2 text-xs text-slate-700">
                  <strong className="block mb-1">Acessórios Standards:</strong>
                  <TechnicalDataDisplay content={v.acessorios_standards} compact />
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Qtd:</span>
                  <span className="font-semibold ml-1">{item.quantidade}</span>
                </div>
                <div>
                  <span className="text-slate-400">Moeda:</span>
                  <span className="font-semibold ml-1">{moeda}</span>
                </div>
                <div>
                  <span className="text-slate-400">Valor Unit.:</span>
                  <span className="font-semibold ml-1">
                    {formatCurrencyByMoeda(item.valor_unitario, moeda)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Desc.:</span>
                  <span className="font-semibold ml-1">
                    {item.desconto_percentual ? `${item.desconto_percentual}%` : ''}
                    {item.desconto_valor
                      ? ` ${formatCurrencyByMoeda(item.desconto_valor, moeda)}`
                      : ''}
                    {!item.desconto_percentual && !item.desconto_valor ? '—' : ''}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold ml-1 text-slate-800">
                    {formatCurrencyByMoeda(itemTotal, moeda)}
                  </span>
                </div>
              </div>

              {proposal.cambio_estimado != null && (
                <div className="mt-1 text-xs text-slate-500">
                  <strong>Câmbio Estimado:</strong> {proposal.cambio_estimado}
                  {proposal.cambio_estimado_data && ` (Data: ${proposal.cambio_estimado_data})`}
                  {proposal.cambio_estimado_base && ` — Base: ${proposal.cambio_estimado_base}`}
                </div>
              )}

              {proposal.acessorios_proposta &&
                Array.isArray(proposal.acessorios_proposta) &&
                (
                  proposal.acessorios_proposta as Array<{
                    nome?: string
                    valor?: number
                    moeda?: string
                  }>
                ).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-1">
                      Acessórios Adicionais:
                    </p>
                    <ul className="text-xs text-slate-600 space-y-0.5">
                      {(
                        proposal.acessorios_proposta as Array<{
                          nome?: string
                          valor?: number
                          moeda?: string
                          quantidade?: number
                        }>
                      ).map((a, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            {a.quantidade ? `${a.quantidade}x ` : ''}
                            {a.nome || '—'}
                          </span>
                          <span className="font-medium">
                            {formatCurrencyByMoeda(a.valor, a.moeda || moeda)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
