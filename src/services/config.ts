import type { ServiceResult } from '@/lib/utils'

export interface AppConfig {
  appName: string
  appShortName: string
  version: string
  environment: string
  supabaseUrl: string
  features: {
    aiSuggestions: boolean
    realtime: boolean
    captcha: boolean
  }
}

export function getAppConfig(): ServiceResult<AppConfig> {
  try {
    return {
      ok: true,
      data: {
        appName: 'Bener Nexus',
        appShortName: 'Nexus',
        version: '1.0.0',
        environment: import.meta.env.MODE,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
        features: {
          aiSuggestions: true,
          realtime: true,
          captcha: !!(import.meta.env.VITE_TURNSTILE_SITE_KEY as string),
        },
      },
    }
  } catch {
    return { ok: false, error: 'Erro ao carregar configurações do aplicativo.' }
  }
}

export function getEdgeFunctionUrl(slug: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${baseUrl}/functions/v1/${slug}`
}

export function isDevelopment(): boolean {
  return import.meta.env.DEV
}

export function isProduction(): boolean {
  return import.meta.env.PROD
}
