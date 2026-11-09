-- Las reglas de acceso de `profiles` son de junio y no conocen el rol
-- canónico super_admin: quien entra como Super Administrador solo podía
-- ver su propio perfil, y el panel de personal salía vacío (solo él).
-- Se agrega super_admin a las dos reglas de gestión, sin quitar nada.
alter policy "Allow management roles to view all profiles" on public.profiles
  using (get_my_role() = any (array['owner', 'seller', 'dev', 'super_admin']));

alter policy "Allow dev and owner to delete/update any profile" on public.profiles
  using (get_my_role() = any (array['owner', 'dev', 'super_admin']));
