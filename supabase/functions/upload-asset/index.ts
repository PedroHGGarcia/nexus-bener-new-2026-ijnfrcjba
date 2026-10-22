import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// High-fidelity vector SVG logos rendered as crisp vector graphics
// 1. NEXUS Logo: Stylized corporate Nexus branding with bold modern typography and emerald X
const NEXUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" width="320" height="80">
  <defs>
    <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="nexusGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
  </defs>
  <!-- Stylized Icon: Connected Nexus hexagon/nodes -->
  <g transform="translate(10, 8)">
    <polygon points="32,4 60,20 60,52 32,68 4,52 4,20" fill="none" stroke="url(#nexusGrad)" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="32" cy="4" r="5" fill="#10b981"/>
    <circle cx="60" cy="20" r="5" fill="#10b981"/>
    <circle cx="60" cy="52" r="5" fill="#047857"/>
    <circle cx="32" cy="68" r="5" fill="#047857"/>
    <circle cx="4" cy="52" r="5" fill="#059669"/>
    <circle cx="4" cy="20" r="5" fill="#059669"/>
    <!-- Central stylized X node -->
    <path d="M20,24 L44,48 M44,24 L20,48" stroke="url(#nexusGrad2)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="4" fill="#10b981"/>
  </g>
  <!-- Wordmark NEXUS -->
  <text x="82" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="38" font-weight="900" letter-spacing="4" fill="#0f172a">NEXUS</text>
  <text x="84" y="66" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2.5" fill="#10b981">GESTÃO COMERCIAL</text>
</svg>`

// 2. BENER Logo: Official Bener Máquinas S.A. green corporate wordmark
const BENER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="300" height="80">
  <defs>
    <linearGradient id="benerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0b3c26" />
      <stop offset="100%" stop-color="#0e5334" />
    </linearGradient>
  </defs>
  <!-- Wordmark BENER -->
  <text x="6" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="900" letter-spacing="2.5" fill="url(#benerGrad)">BENER</text>
  <!-- Tagline MÁQUINAS QUE TRANSFORMAM -->
  <text x="8" y="67" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="9" font-weight="700" letter-spacing="1.8" fill="#0b3c26">MÁQUINAS QUE TRANSFORMAM</text>
</svg>`

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const { name, base64, action, format, printB64 } = body

    if (req.method === 'GET') {
      const url = new URL(req.url)
      if (url.searchParams.get('test') === 'check-logos') {
        const nexusUrl = adminClient.storage.from('public').getPublicUrl('logos/nexus-logo.png')
          .data.publicUrl
        const benerUrl = adminClient.storage.from('public').getPublicUrl('logos/bener-logo.png')
          .data.publicUrl
        const [rNexus, rBener] = await Promise.all([fetch(nexusUrl), fetch(benerUrl)])
        return new Response(
          JSON.stringify({
            nexusStatus: rNexus.status,
            nexusType: rNexus.headers.get('content-type'),
            nexusLength: rNexus.headers.get('content-length'),
            benerStatus: rBener.status,
            benerType: rBener.headers.get('content-type'),
            benerLength: rBener.headers.get('content-length'),
          }),
          { headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      if (url.searchParams.get('test') === 'check-env') {
        return new Response(
          JSON.stringify({
            envKeys: Object.keys(Deno.env.toObject()),
          }),
          { headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    }

    // Auto-seed action or direct GET/POST without custom payload:
    // seeds both SVG and TRUE PNG representations to public, propostas-files, and versoes-images buckets!
    if (action === 'seed-default-logos' || req.method === 'GET' || (!name && !base64)) {
      const buckets = ['public', 'propostas-files']
      const seedResults: Record<string, any> = {}

      // Import official PNG bytes from _shared/official-logos.ts
      const { getOfficialNexusLogoPng, getOfficialBenerLogoPng } =
        await import('../_shared/official-logos.ts')
      const nexusPngBytes = getOfficialNexusLogoPng()
      const benerPngBytes = getOfficialBenerLogoPng()

      const encoder = new TextEncoder()
      const nexusSvgBytes = encoder.encode(NEXUS_SVG)
      const benerSvgBytes = encoder.encode(BENER_SVG)

      for (const bucket of buckets) {
        try {
          await adminClient.storage.createBucket(bucket, { public: true })
        } catch {
          // ignore
        }

        // Upload true binary PNGs with image/png mimetype
        const { error: nexusPngErr } = await adminClient.storage
          .from(bucket)
          .upload('logos/nexus-logo.png', nexusPngBytes, {
            contentType: 'image/png',
            upsert: true,
          })
        const { error: benerPngErr } = await adminClient.storage
          .from(bucket)
          .upload('logos/bener-logo.png', benerPngBytes, {
            contentType: 'image/png',
            upsert: true,
          })

        // Also upload SVGs for modern vector consumers
        await adminClient.storage.from(bucket).upload('logos/nexus-logo.svg', nexusSvgBytes, {
          contentType: 'image/svg+xml',
          upsert: true,
        })
        await adminClient.storage.from(bucket).upload('logos/bener-logo.svg', benerSvgBytes, {
          contentType: 'image/svg+xml',
          upsert: true,
        })

        const nexusUrl = adminClient.storage.from(bucket).getPublicUrl('logos/nexus-logo.png')
          .data.publicUrl
        const benerUrl = adminClient.storage.from(bucket).getPublicUrl('logos/bener-logo.png')
          .data.publicUrl

        seedResults[bucket] = {
          nexusUrl,
          benerUrl,
          nexusPngBytes: nexusPngBytes.length,
          benerPngBytes: benerPngBytes.length,
          nexusPngErr: nexusPngErr?.message || null,
          benerPngErr: benerPngErr?.message || null,
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'True PNG and SVG logos seeded successfully to storage buckets',
          results: seedResults,
        }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (action === 'download-and-store-official-logos') {
      const nexusRemoteUrl =
        'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/a25e05ea-3712-4042-a6b8-933968ac9fbc/image-2cd81.png'
      const benerRemoteUrl =
        'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/a25e05ea-3712-4042-a6b8-933968ac9fbc/image-d0515.png'

      const [nexusRes, benerRes] = await Promise.all([fetch(nexusRemoteUrl), fetch(benerRemoteUrl)])

      if (!nexusRes.ok || !benerRes.ok) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch official logos from source URLs',
            nexusStatus: nexusRes.status,
            benerStatus: benerRes.status,
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const nexusBuffer = await nexusRes.arrayBuffer()
      const benerBuffer = await benerRes.arrayBuffer()

      const nexusBytes = new Uint8Array(nexusBuffer)
      const benerBytes = new Uint8Array(benerBuffer)

      // Convert to base64 chunks for safe inspection / embedding
      const toBase64 = (u8: Uint8Array) => {
        let binary = ''
        const len = u8.byteLength
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(u8[i])
        }
        return btoa(binary)
      }

      const nexusB64 = toBase64(nexusBytes)
      const benerB64 = toBase64(benerBytes)

      // Upload directly into public bucket
      const { error: nexusUpErr } = await adminClient.storage
        .from('public')
        .upload('logos/nexus-logo.png', nexusBytes, {
          contentType: 'image/png',
          upsert: true,
        })

      const { error: benerUpErr } = await adminClient.storage
        .from('public')
        .upload('logos/bener-logo.png', benerBytes, {
          contentType: 'image/png',
          upsert: true,
        })

      // Also ensure propostas-files bucket has them
      try {
        await adminClient.storage.createBucket('propostas-files', { public: true })
        await adminClient.storage
          .from('propostas-files')
          .upload('logos/nexus-logo.png', nexusBytes, {
            contentType: 'image/png',
            upsert: true,
          })
        await adminClient.storage
          .from('propostas-files')
          .upload('logos/bener-logo.png', benerBytes, {
            contentType: 'image/png',
            upsert: true,
          })
      } catch {
        // ignore
      }

      return new Response(
        JSON.stringify({
          success: true,
          nexusSize: nexusBytes.length,
          benerSize: benerBytes.length,
          nexusUpErr: nexusUpErr?.message || null,
          benerUpErr: benerUpErr?.message || null,
          nexusB64,
          benerB64,
        }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (!name || !base64) {
      return new Response(JSON.stringify({ error: 'name and base64 are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const targetBucket = (body.bucket as string) || 'public'
    const targetPath = (body.path as string) || `logos/${name}`

    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Ensure bucket exists and is public
    try {
      await adminClient.storage.createBucket(targetBucket, { public: true })
    } catch {
      // already exists or cannot create
    }

    const { error: uploadError } = await adminClient.storage
      .from(targetBucket)
      .upload(targetPath, bytes, {
        contentType: (body.contentType as string) || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message, bucket: targetBucket, path: targetPath }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const { data: urlData } = adminClient.storage.from(targetBucket).getPublicUrl(targetPath)

    return new Response(
      JSON.stringify({
        success: true,
        bucket: targetBucket,
        path: targetPath,
        publicUrl: urlData.publicUrl,
        size: bytes.length,
        base64Sample: base64.slice(0, 50),
        base64Full: printB64 ? base64 : undefined,
      }),
      { headers: { 'Content-Type': 'application/json', ...cors } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
