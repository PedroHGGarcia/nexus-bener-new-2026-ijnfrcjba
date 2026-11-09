import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(async () => {
  try {
    const res = await fetch(
      'https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/test-chatbot-probe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    const json = await res.json()
    console.log('--- OPENAI RESPONSE ---')
    console.log(JSON.stringify(json))
    console.log('--- END OPENAI RESPONSE ---')
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('Call error:', err)
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 })
  }
})
