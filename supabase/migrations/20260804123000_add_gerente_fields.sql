-- Add new columns to the existing gerentes table (idempotent)
ALTER TABLE public.gerentes ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.gerentes ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE public.gerentes ADD COLUMN IF NOT EXISTS rd_station_id TEXT;
