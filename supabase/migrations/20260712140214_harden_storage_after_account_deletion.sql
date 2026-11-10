DROP POLICY IF EXISTS "medical_documents_owner_all" ON storage.objects;

CREATE POLICY "medical_documents_owner_all"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND (SELECT public.current_app_user_id()) IS NOT NULL
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.can_manage_user((storage.foldername(name))[1])
  )
)
WITH CHECK (
  bucket_id = 'medical-documents'
  AND (SELECT public.current_app_user_id()) IS NOT NULL
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.can_manage_user((storage.foldername(name))[1])
  )
);

DROP POLICY IF EXISTS "exports_owner_all" ON storage.objects;

CREATE POLICY "exports_owner_all"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (SELECT public.current_app_user_id()) IS NOT NULL
)
WITH CHECK (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (SELECT public.current_app_user_id()) IS NOT NULL
);
