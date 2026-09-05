import { NextResponse } from 'next/server';
import { listRecipes } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(listRecipes());
}
