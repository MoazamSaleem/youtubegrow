-- Allow users to manage their own text-to-speech history entries.

DROP POLICY IF EXISTS "Users can update their own tts generations" ON public.tts_generations;
CREATE POLICY "Users can update their own tts generations"
  ON public.tts_generations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tts generations" ON public.tts_generations;
CREATE POLICY "Users can delete their own tts generations"
  ON public.tts_generations
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tts audio" ON storage.objects;
CREATE POLICY "Users can delete their own tts audio"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tts-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
