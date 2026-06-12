
CREATE POLICY "Users read own business-docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'business-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own business-docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own business-docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own business-docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
