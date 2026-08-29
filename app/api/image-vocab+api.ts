type ImageVocabCandidate = {
  term: string;
  translation: string;
  definition: string;
  contextSentence: string;
  partOfSpeech: string;
  usefulnessScore: number;
  confidenceScore: number;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

const MAX_IMAGES = 3;
const MAX_DATA_URL_CHARS = 9_000_000;
const MAX_TOTAL_DATA_URL_CHARS = 20_000_000;
const MAX_CANDIDATES = 40;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value)
    && value.length <= MAX_DATA_URL_CHARS;
}

function textFromResponse(body: OpenAIResponse): string | null {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text;
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) return content.text;
    }
  }
  return null;
}

function isCandidate(value: unknown): value is ImageVocabCandidate {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.term === 'string'
    && typeof item.translation === 'string'
    && typeof item.definition === 'string'
    && typeof item.contextSentence === 'string'
    && typeof item.partOfSpeech === 'string'
    && typeof item.usefulnessScore === 'number'
    && typeof item.confidenceScore === 'number';
}

function parseCandidates(text: string): ImageVocabCandidate[] {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid structured response.');
  const raw = (parsed as Record<string, unknown>).candidates;
  if (!Array.isArray(raw)) throw new Error('Missing candidates.');
  return raw
    .filter(isCandidate)
    .map((item) => ({
      ...item,
      term: item.term.trim().replace(/\s+/g, ' '),
      translation: item.translation.trim(),
      definition: item.definition.trim(),
      contextSentence: item.contextSentence.trim(),
      partOfSpeech: item.partOfSpeech.trim(),
      usefulnessScore: Math.max(0, Math.min(1, item.usefulnessScore)),
      confidenceScore: Math.max(0, Math.min(1, item.confidenceScore)),
    }))
    .filter((item) => item.term && item.translation)
    .slice(0, MAX_CANDIDATES);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return json({ message: 'AI image import is not configured yet. Add OPENAI_API_KEY to the Expo preview environment.' }, 503);
    }

    const body = await request.json() as Record<string, unknown>;
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images = rawImages.filter(isImageDataUrl).slice(0, MAX_IMAGES);
    if (!images.length || images.length !== rawImages.length) {
      return json({ message: 'Choose up to three JPG, PNG, or WebP images.' }, 400);
    }
    if (images.reduce((sum, value) => sum + value.length, 0) > MAX_TOTAL_DATA_URL_CHARS) {
      return json({ message: 'These images are too large. Try a clearer crop or fewer images.' }, 413);
    }

    const targetLanguage = typeof body.targetLanguage === 'string' && body.targetLanguage.trim() ? body.targetLanguage.trim() : 'English';
    const referenceLanguage = typeof body.referenceLanguage === 'string' && body.referenceLanguage.trim() ? body.referenceLanguage.trim() : 'Arabic';
    if (targetLanguage.toLocaleLowerCase() !== 'english') {
      return json({ message: 'Image import currently extracts English vocabulary.' }, 400);
    }

    const prompt = [
      `Extract useful ${targetLanguage} vocabulary and fixed phrases that are visibly present in the supplied image(s).`,
      `Translate each item naturally into ${referenceLanguage}.`,
      'For every item, write a concise English learner definition and one short, natural English example sentence that contains the word or phrase.',
      'Return the base or dictionary form when the image shows an inflected form, unless the visible multiword expression is a useful fixed phrase.',
      'Prefer useful vocabulary over names, page numbers, isolated punctuation, interface chrome, repeated words, and full sentences.',
      'Do not invent vocabulary that is not visible in the images. Deduplicate repeated items across images.',
      `Return at most ${MAX_CANDIDATES} items, ordered by learner usefulness.`,
      'Use a simple part-of-speech label such as noun, verb, adjective, adverb, phrase, phrasal verb, or expression.',
      'usefulnessScore and confidenceScore must be numbers from 0 to 1.',
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_VOCAB_MODEL?.trim() || 'gpt-5.6-luna',
        store: false,
        reasoning: { effort: 'low' },
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...images.map((imageUrl) => ({ type: 'input_image', image_url: imageUrl, detail: 'high' })),
          ],
        }],
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'image_vocabulary_import',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                candidates: {
                  type: 'array',
                  maxItems: MAX_CANDIDATES,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      term: { type: 'string' },
                      translation: { type: 'string' },
                      definition: { type: 'string' },
                      contextSentence: { type: 'string' },
                      partOfSpeech: { type: 'string' },
                      usefulnessScore: { type: 'number', minimum: 0, maximum: 1 },
                      confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
                    },
                    required: ['term', 'translation', 'definition', 'contextSentence', 'partOfSpeech', 'usefulnessScore', 'confidenceScore'],
                  },
                },
              },
              required: ['candidates'],
            },
          },
        },
      }),
    });

    const responseBody = await response.json() as OpenAIResponse;
    if (!response.ok) {
      console.error('Image vocabulary OpenAI request failed', response.status, responseBody.error?.message ?? 'unknown error');
      return json({ message: 'The AI could not analyze this image right now. Please try again.' }, 502);
    }

    const outputText = textFromResponse(responseBody);
    if (!outputText) return json({ message: 'The AI returned no vocabulary for this image.' }, 422);

    const candidates = parseCandidates(outputText);
    if (!candidates.length) return json({ message: 'No clear English vocabulary was found. Try a sharper or tighter image.' }, 422);
    return json({ candidates });
  } catch (error) {
    console.error('Image vocabulary import failed', error);
    return json({ message: 'Could not analyze the image. Please try again.' }, 500);
  }
}
