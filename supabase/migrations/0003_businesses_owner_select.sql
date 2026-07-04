-- "member select" usa is_business_member(id), que consulta businesses;
-- en un INSERT ... RETURNING la fila nueva aún no es visible en el snapshot
-- del propio statement, así que la policy devolvía false y el RETURNING
-- fallaba con 42501. Esta policy evalúa columnas de la propia fila (sin
-- subconsulta a businesses), por lo que el dueño siempre ve su fila,
-- incluida la recién insertada.
create policy "owner select" on public.businesses for select
  using (owner_id = auth.uid());
