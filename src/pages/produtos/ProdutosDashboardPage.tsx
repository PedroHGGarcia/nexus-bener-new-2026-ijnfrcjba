import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { benerStore } from '@/services/store'

export default function ProdutosDashboardPage() {
  const products = benerStore.products
  const totalEstoque = products.reduce((acc, p) => acc + p.estoque, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard do Catálogo de Produtos</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Modelos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total no Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalEstoque} un</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertas de Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">1 modelo</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
