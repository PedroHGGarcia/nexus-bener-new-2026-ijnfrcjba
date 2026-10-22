import { useState } from 'react'
import { ExtratorVersoesImporter } from '@/components/produtos/ExtratorVersoesBatchImporter'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, FileSpreadsheet, Sparkles } from 'lucide-react'

export default function ImportarVersoesPage() {
  const [activeTab, setActiveTab] = useState<'extrator' | 'generico'>('extrator')

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Componente principal de importação (atende 100% às regras da usuária Bianca) */}
      <ExtratorVersoesImporter />
    </div>
  )
}
