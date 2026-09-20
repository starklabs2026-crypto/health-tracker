-- Reduce RLS policy overhead without changing HealthFolio's access model.

DROP POLICY IF EXISTS user_insert_own ON public."User";
CREATE POLICY user_insert_own
ON public."User"
FOR INSERT
TO authenticated
WITH CHECK (
  "authUserId" = (SELECT auth.uid())::text
  OR id = (SELECT auth.uid())::text
);

-- The previous ALL policy duplicated SELECT coverage with
-- family_link_select_related. Keep the same owner write privileges, but split
-- writes by action so SELECT is evaluated only by the dedicated SELECT policy.
DROP POLICY IF EXISTS family_link_owner_write ON public."FamilyLink";

CREATE POLICY family_link_owner_insert
ON public."FamilyLink"
FOR INSERT
TO authenticated
WITH CHECK ("ownerUserId" = (SELECT public.current_app_user_id()));

CREATE POLICY family_link_owner_update
ON public."FamilyLink"
FOR UPDATE
TO authenticated
USING ("ownerUserId" = (SELECT public.current_app_user_id()))
WITH CHECK ("ownerUserId" = (SELECT public.current_app_user_id()));

CREATE POLICY family_link_owner_delete
ON public."FamilyLink"
FOR DELETE
TO authenticated
USING ("ownerUserId" = (SELECT public.current_app_user_id()));
