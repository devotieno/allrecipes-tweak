import { NextRequest, NextResponse } from 'next/server';
import { getRecipeById, deleteRecipeById } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const recipe = getRecipeById(params.id);
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json(recipe);
}

// Used by the "Refresh" button -- deletes the stored entry so the next
// /api/scrape call for the same URL re-scrapes and regenerates tweaks
// instead of returning the cached version.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const deleted = deleteRecipeById(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
