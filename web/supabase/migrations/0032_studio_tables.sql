-- Migração 0032: Estrutura do Estúdio GoLive (LiveKit + Mixer)

-- 1. Adicionar valor 'studio' ao TYPE ENUM stream_provider
ALTER TYPE public.stream_provider ADD VALUE IF NOT EXISTS 'studio';

-- 2. Tabela de estado da sala do estúdio por evento
CREATE TABLE IF NOT EXISTS public.studio_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  active_layout VARCHAR(50) NOT NULL DEFAULT 'grid', -- 'solo', 'grid', 'split', 'spotlight', 'presentation'
  active_scene_id VARCHAR(50) DEFAULT 'default',
  spotlight_participant_id VARCHAR(255) DEFAULT NULL,
  active_banner_id UUID DEFAULT NULL,
  active_ticker_text TEXT DEFAULT NULL,
  active_overlay_url TEXT DEFAULT NULL,
  active_background_url TEXT DEFAULT NULL,
  active_logo_url TEXT DEFAULT NULL,
  active_presentation_id UUID DEFAULT NULL,
  active_slide_index INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de assets visuais do estúdio (banners, GCs, logos, overlays, vinhetas, apresentações)
CREATE TABLE IF NOT EXISTS public.studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL, -- 'gc_name', 'banner', 'ticker', 'logo', 'overlay', 'background', 'video_clip', 'presentation'
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) DEFAULT NULL,
  content_json JSONB DEFAULT '{}'::jsonb,
  file_url TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_studio_rooms_event_id ON public.studio_rooms(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_assets_event_id ON public.studio_assets(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_assets_type ON public.studio_assets(event_id, asset_type);

-- RLS (Row Level Security)
ALTER TABLE public.studio_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_assets ENABLE ROW LEVEL SECURITY;

-- Leitura pública / participante autenticado
CREATE POLICY studio_rooms_select ON public.studio_rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY studio_assets_select ON public.studio_assets
  FOR SELECT TO authenticated USING (true);

-- Leitura anônima para a sala de output/estúdio
CREATE POLICY studio_rooms_select_anon ON public.studio_rooms
  FOR SELECT TO anon USING (true);

CREATE POLICY studio_assets_select_anon ON public.studio_assets
  FOR SELECT TO anon USING (true);

-- Escrita restrita ao staff com can_stream ou gestor/admin do evento
CREATE POLICY studio_rooms_all_staff ON public.studio_rooms
  FOR ALL TO authenticated
  USING (
    public.has_event_role(event_id, 'stream') OR
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE e.id = studio_rooms.event_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    ) OR
    public.is_admin()
  );

CREATE POLICY studio_assets_all_staff ON public.studio_assets
  FOR ALL TO authenticated
  USING (
    public.has_event_role(event_id, 'stream') OR
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE e.id = studio_assets.event_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    ) OR
    public.is_admin()
  );

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_studio_rooms_updated_at ON public.studio_rooms;
CREATE TRIGGER set_studio_rooms_updated_at
  BEFORE UPDATE ON public.studio_rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_studio_assets_updated_at ON public.studio_assets;
CREATE TRIGGER set_studio_assets_updated_at
  BEFORE UPDATE ON public.studio_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
