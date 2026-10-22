# Bener Nexus - Deployment Preparation

## Production Environment Variables (Frontend)

Set in `.env` or deployment platform:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/publishable key
- `VITE_APP_PUBLIC_URL` - Public URL of the deployed app

## Supabase Secrets (Edge Functions)

Set via Supabase Dashboard > Project Settings > Edge Functions > Secrets:

- `OPENAI_API_KEY` - OpenAI API key for AI suggestions and chatbot (required for versoes-chatbot, ai-suggestions and suggest-specs edge functions)
- `RECAPTCHA_SECRET_KEY` - Google reCAPTCHA secret key
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key
- `RESEND_API_KEY` - Resend API key for email sending

## Deployment Steps

1. Ensure all migrations are applied to the Supabase database
2. Set all Supabase secrets listed above
3. Connect GitHub repository (if GitHub integration is available)
4. Disable auto-deploys to Skip Cloud (manual deploys only)
5. Configure custom domain if needed
6. Trigger a manual deployment
7. Verify the production build completes with zero TypeScript errors
8. Verify all features work end-to-end against the connected Supabase backend

## Build Verification

- Run `pnpm build` to verify zero TypeScript errors
- Verify bundle size is acceptable (route pages remain lazy-loaded)
- All chunks should be reasonably sized

## Pre-deployment Checklist

- [ ] Authentication: login, logout, password recovery
- [ ] All CRUD pages: create, read, update, delete operations
- [ ] Search and filters on all tables
- [ ] Pagination (default 50 records per page)
- [ ] Dark mode toggle and persistence
- [ ] Mobile responsiveness (below 768px)
- [ ] Proposal creation, printing, signatures
- [ ] Project-proposal linking
- [ ] Dashboard widgets with real data
- [ ] Notifications bell and mark-as-read
- [ ] Audit log recording
- [ ] File uploads (images, KML)
- [ ] Edge functions responding correctly
- [ ] Versoes chatbot & IA: OPENAI_API_KEY secret configured and functions return AI responses (not 500 errors)
- [ ] Error/empty/loading states with Portuguese messages
- [ ] User permissions (menu_access per role)
