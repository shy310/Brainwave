/** Speech-to-text models on OpenRouter (GET /api/v1/models?output_modalities=transcription, 2026-11-20). */
export const DEFAULT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
  'openai/gpt-4o-mini-transcribe',
  'openai/gpt-4o-transcribe',
  'openai/gpt-transcribe',
  'google/gemini-3.5-transcribe',
  'google/chirp-3',
  'elevenlabs/scribe-v2',
  'mistralai/voxtral-mini-transcribe',
  'deepgram/nova-3',
  'assemblyai/universal-3-6-pro',
];
