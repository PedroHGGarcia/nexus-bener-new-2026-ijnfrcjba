import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FileSpreadsheet } from 'lucide-react'
import { TiposPropostaBatchImporter } from './TiposPropostaBatchImporter'

interface ImportTiposPropostasSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportTiposPropostasSheet({
  open,
  onOpenChange,
  onSuccess,
}: ImportTiposPropostasSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl w-full flex flex-col h-full overflow-hidden p-6">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <SheetTitle className="text-xl text-[#0b3c26] font-bold">
                Importar e Atualizar Tipos de Proposta
              </SheetTitle>
              <SheetDescription className="text-xs">
                Atualização em lote via arquivo CSV ou Excel com mapeamento e pré-visualização.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <TiposPropostaBatchImporter onSuccess={onSuccess} onClose={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
