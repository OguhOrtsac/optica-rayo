-- Las reglas RLS de junio enumeran los roles de gestión como
-- ('owner','seller','dev') y no conocen el rol canónico super_admin:
-- el Super Administrador no podía LEER ventas, recordatorios, solicitudes,
-- exámenes ni perfiles de cliente, así que su panel salía en ceros aunque
-- los datos existieran. Se agrega 'super_admin' a las 18 reglas afectadas,
-- sin quitar ningún acceso existente. (profiles y products ya se habían
-- corregido en migraciones anteriores del mismo día.)
alter policy "Owner and dev can update clinical_exams" on public.clinical_exams using (get_my_role() = any (array['owner','dev','super_admin']));
alter policy "Staff can insert clinical_exams" on public.clinical_exams with check (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Staff can read all clinical_exams" on public.clinical_exams using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to manage coupons" on public.coupons using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Owner and dev can update any customer_profile" on public.customer_profiles using (get_my_role() = any (array['owner','dev','super_admin']));
alter policy "Staff can insert customer_profiles" on public.customer_profiles with check (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Staff can read all customer_profiles" on public.customer_profiles using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to manage reminders" on public.reminders using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to insert sale items" on public.sale_items with check (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to view all sale items" on public.sale_items using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to create sales" on public.sales with check (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff and dev to view all sales" on public.sales using (get_my_role() = any (array['owner','seller','dev','super_admin']));
alter policy "Allow staff to manage lens materials" on public.lens_materials using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
alter policy "Staff can view and manage all lens requests" on public.lens_requests using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
alter policy "Allow staff to manage lens treatments" on public.lens_treatments using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
alter policy "Staff can view and manage all installments" on public.payment_installments using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
alter policy "Allow staff to insert sale item treatments" on public.sale_item_treatments with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
alter policy "Allow staff to view all sale item treatments" on public.sale_item_treatments using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['owner','seller','dev','super_admin'])));
