import { Recipe, Tweak } from './types';
import Groq from 'groq-sdk';

function sanitizeReviewText(raw: string): string {
  return raw
    .replace(/Read More/gi, '')
    .replace(/\d+\s*Repl(y|ies)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function applyTweak(original: Recipe, tweak: Tweak) {
  const tweakText = sanitizeReviewText(tweak.text);

  let cleanIngredients = original.ingredients;
  if (cleanIngredients.length === 1 && cleanIngredients[0].length > 60) {
    cleanIngredients = cleanIngredients[0]
      .split(/(?=\d+\s)/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2);
  }
  cleanIngredients = Array.from(new Set(cleanIngredients)).filter(Boolean);

  const cleanInstructions = original.instructions.filter(
    (l) => !l.toLowerCase().includes('could not extract')
  );

  // If Groq fails, fall back to the unmodified recipe -- the UI already
  // shows success:false and grays the tweak out, so no need to fake a
  // change here.
  const fallback = {
    modifiedIngredients: original.ingredients,
    modifiedInstructions:
      cleanInstructions.length > 0 ? cleanInstructions : original.instructions,
    success: false,
  };

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is missing');
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const numberedInstructions = cleanInstructions
      .map((step, idx) => `${idx + 1}. ${step}`)
      .join('\n');

    const prompt = `
You are an expert recipe editor.

Current Ingredients:
${cleanIngredients.map((i) => `- ${i}`).join('\n')}

Current Instructions:
${numberedInstructions || '(none extracted)'}

User Review:
"${tweakText}"

Your task:
- Read the user review carefully and figure out what they actually changed.
- Update the ingredient list to reflect it: adjust amounts, add new ingredients,
  replace substituted ones. Keep everything else the same.
- Rewrite the instructions so they're consistent with the new ingredients and
  with anything the review says about the process itself (e.g. a different pan,
  a shorter bake time, an extra step, forming the batter into muffins instead
  of a loaf). Keep the same overall structure and step count where nothing
  changed -- only touch the steps that are actually affected.
- If the review doesn't mention anything relevant to the instructions, return
  the instructions unchanged.
- Never invent ingredients or steps the review doesn't support.

Return ONLY valid JSON in this exact shape:

{
  "modifiedIngredients": ["...", "..."],
  "modifiedInstructions": ["...", "..."]
}
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      // llama-3.3-70b-versatile moved to Enterprise-only access on Groq.
      // openai/gpt-oss-120b is the current standard-developer-tier model
      // with comparable quality for this kind of structured JSON task.
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const modifiedIngredients =
      Array.isArray(parsed.modifiedIngredients) && parsed.modifiedIngredients.length > 0
        ? parsed.modifiedIngredients
        : cleanIngredients;

    const modifiedInstructions =
      Array.isArray(parsed.modifiedInstructions) && parsed.modifiedInstructions.length > 0
        ? parsed.modifiedInstructions
        : cleanInstructions;

    return {
      modifiedIngredients,
      modifiedInstructions,
      success: true,
    };
  } catch (error) {
    console.error('Groq error for tweak', tweak.id, error);
    return fallback;
  }
}