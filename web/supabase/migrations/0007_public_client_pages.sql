-- ============================================================
-- Migração 0007: páginas públicas do cliente
-- RPCs para resolver o slug do cliente sem abrir a tabela clients
-- (evento por link direto funciona mesmo com pasta privada/restrita)
-- ============================================================

-- Dados públicos do cliente + se quem chama pode ver a pasta (agregadora)
create or replace function get_public_client(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  brand_color text,
  brand_logo_url text,
  bg_image_url text,
  bg_image_mobile_url text,
  can_view_folder boolean
)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.slug, c.brand_color, c.brand_logo_url,
         c.bg_image_url, c.bg_image_mobile_url,
         (
           c.folder_visibility = 'public'
           or is_client_member(c.id)
           or (c.folder_visibility = 'restricted' and is_client_participant(c.id))
         ) as can_view_folder
  from clients c
  where c.slug = p_slug;
$$;

-- Slug do cliente a partir do id (para redirecionar /e/slug à URL canônica)
create or replace function get_client_slug(p_client_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select slug from clients where id = p_client_id;
$$;
