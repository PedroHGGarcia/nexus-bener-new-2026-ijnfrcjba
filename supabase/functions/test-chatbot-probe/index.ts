import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const OPENAI_MODEL = 'gpt-6-luna'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

Deno.serve(async () => {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  const systemPrompt = `Você é um engenheiro sênior especialista em CSS de impressão e Chromium (Blink print engine).
A proposta comercial da Bener Máquinas é impressa via browser (Chrome/Edge - window.print()).
Atualmente na seção "Termos de Fornecimento" (seção 7.1 a 7.7) e "Informações Adicionais":
- Cada termo é renderizado com markup:
  <div class="term-item block w-full mb-3 break-inside-avoid">
    <div class="term-title block font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">...</div>
    <div class="term-content block w-full text-black font-normal whitespace-pre-wrap leading-relaxed break-words text-xs sm:text-[13px]">...</div>
  </div>
- E no CSS global (@media print em src/main.css):
  .proposal-document tr,
  .proposal-document .break-inside-avoid {
    page-break-inside: avoid;
    break-inside: avoid;
  }

O PROBLEMA:
"Do termo 7.1 para o 7.2 ele pula metade da página e passa pra próxima página para colocar o texto do 7.2 sendo que tinha ainda mais da metade da página disponível."

DESEJO DO USUÁRIO:
"Quero que ele pule para a próxima página somente quando o proximo titulo couber 3 linhas ou menos dentro daquela página" (ou seja: o termo deve quebrar livremente pelo meio se necessário; o título do termo nunca deve ficar sozinho/órfão no fim da página, exigindo pelo menos ~3 linhas de texto abaixo para permanecer na página atual; se não couber título + 3 linhas, o título deve pular para a próxima página).

PERGUNTAS PARA VOCÊ ESPECIFICAR:
1. Qual regra no @media print de src/main.css e no JSX de ProposalDocument.tsx deve ser aplicada?
2. Como garantir que .proposal-document .term-item não herde 'break-inside: avoid' da regra global '.proposal-document .break-inside-avoid'? (Devemos remover 'break-inside-avoid' da classe de .term-item no JSX E colocar regra explícita no CSS?)
3. Como garantir que .term-title fique colado às primeiras linhas do .term-content (break-after: avoid; page-break-after: avoid;)?
4. No .term-content (e em seus parágrafos ou no bloco com whitespace-pre-wrap), quais propriedades (orphans: 3, widows: 3, break-inside: auto) garantem a regra das 3 linhas mínimas no motor Chromium?
5. A seção "Informações Adicionais" tem o mesmo markup de .term-item / .term-title / .term-content. Devemos garantir que as classes em src/main.css atendam ambas?

Forneça o bloco CSS final pronto para ser inserido em src/main.css e as alterações no JSX.`

  try {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Forneça a análise e o código CSS e JSX exatos.' },
        ],
        reasoning_effort: 'none',
        max_completion_tokens: 2500,
      }),
    })

    const rawData = await resp.json()
    return new Response(JSON.stringify({ status: resp.status, rawData }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 })
  }
})
