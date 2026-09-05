import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { scrapeRecipe } from '@/lib/scrapeRecipe';
import { applyTweak } from '@/lib/applyTweak';
import { getRecipeByUrl, saveRecipe } from '@/lib/store';
import { StoredRecipe, ModifiedRecipe } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !url.includes('allrecipes.com')) {
      return NextResponse.json(
        { error: 'Please paste a valid allrecipes.com recipe link.' },
        { status: 400 }
      );
    }

    // Avoid re-scraping a recipe we already have.
    const existing = getRecipeByUrl(url);
    if (existing) {
      return NextResponse.json(existing);
    }

    const { original, tweaks } = await scrapeRecipe(url);

    // Generate a modified recipe per tweak, in parallel -- Groq is fast
    // enough that this is fine even with a dozen tweaks.
    const modifications: ModifiedRecipe[] = await Promise.all(
      tweaks.map(async (tweak) => {
        const result = await applyTweak(original, tweak);
        return {
          tweakId: tweak.id,
          author: tweak.author,
          tweakText: tweak.text,
          modifiedIngredients: result.modifiedIngredients,
          modifiedInstructions: result.modifiedInstructions,
          success: result.success,
        };
      })
    );

    const stored: StoredRecipe = {
      id: uuid(),
      url,
      original,
      tweaks,
      modifications,
      createdAt: new Date().toISOString(),
    };

    saveRecipe(stored);

    return NextResponse.json(stored);
  } catch (error: any) {
    console.error('Scrape route error:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Couldn't load that recipe. The page might have a layout our scraper doesn't recognize.",
      },
      { status: 500 }
    );
  }
}
