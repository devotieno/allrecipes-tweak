'use client';

import { useEffect, useState } from 'react';
import { DiffList } from '@/components/DiffList';
import type { StoredRecipe, RecipeSummary } from '@/lib/types';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [selectedTweakId, setSelectedTweakId] = useState<string | null>(null);
  const [previous, setPrevious] = useState<RecipeSummary[]>([]);

  useEffect(() => {
    refreshPrevious();
  }, []);

  function refreshPrevious() {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then(setPrevious)
      .catch(() => {});
  }

  async function loadRecipe(targetUrl: string) {
    if (!targetUrl) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load recipe');
      setRecipe(data);
      setSelectedTweakId(data.modifications[0]?.tweakId ?? null);
      refreshPrevious();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrevious(id: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/recipes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load recipe');
      setRecipe(data);
      setSelectedTweakId(data.modifications[0]?.tweakId ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Deletes the cached entry, then re-scrapes and re-generates every tweak
  // from scratch. Useful after changing the scraper or the LLM prompt/model
  // -- without this, /api/scrape just keeps returning the stale cached
  // version for a URL it's already seen.
  async function refreshRecipe(id: string, targetUrl: string) {
    setLoading(true);
    setError('');
    try {
      await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      await loadRecipe(targetUrl);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const selectedMod = recipe?.modifications.find((m) => m.tweakId === selectedTweakId) ?? null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <p className="mb-4 text-sm text-gray-500">Paste any AllRecipes link</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 font-semibold">Load Recipe</h2>
            <input
              className="mb-2 w-full rounded border px-3 py-2 text-sm"
              placeholder="https://www.allrecipes.com/recipe/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRecipe(url)}
            />
            <button
              className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading || !url}
              onClick={() => loadRecipe(url)}
            >
              {loading ? 'Loading…' : 'Load Recipe'}
            </button>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>

          {recipe && (
            <div className="rounded-lg border bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Featured Tweaks</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {recipe.modifications.length}
                </span>
              </div>

              {recipe.modifications.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No featured tweaks found on this page. Showing the original recipe.
                </p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  <button
                    onClick={() => setSelectedTweakId(null)}
                    className={`w-full rounded border p-2 text-left text-xs ${
                      selectedTweakId === null ? 'border-black' : 'border-gray-200'
                    }`}
                  >
                    <span className="font-medium">Original recipe</span>
                  </button>
                  {recipe.modifications.map((m) => (
                    <button
                      key={m.tweakId}
                      onClick={() => setSelectedTweakId(m.tweakId)}
                      className={`w-full rounded border p-2 text-left text-xs ${
                        selectedTweakId === m.tweakId ? 'border-black' : 'border-gray-200'
                      } ${!m.success ? 'opacity-60' : ''}`}
                    >
                      <div className="font-medium text-gray-600">{m.author}</div>
                      <div className="line-clamp-2">{m.tweakText}</div>
                      {!m.success && (
                        <div className="mt-1 text-red-500">Couldn&apos;t generate modification</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {previous.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="mb-2 font-semibold">Previously loaded</h2>
              <div className="space-y-1">
                {previous.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      onClick={() => loadPrevious(p.id)}
                      className="flex-1 truncate rounded-full border px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                    >
                      {p.title}
                    </button>
                    <button
                      onClick={() => refreshRecipe(p.id, p.url)}
                      title="Re-scrape and regenerate this recipe's tweaks"
                      disabled={loading}
                      className="rounded-full border px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      ↻
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="rounded-lg border bg-white p-6">
          {!recipe ? (
            <p className="text-sm text-gray-400">Load a recipe to get started.</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{recipe.original.title}</h1>

              {selectedMod && (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    Modified by <span className="font-medium">{selectedMod.author}</span>
                  </p>
                  <blockquote className="mt-3 border-l-4 border-blue-300 bg-blue-50 px-3 py-2 text-sm italic text-blue-900">
                    {selectedMod.tweakText}
                  </blockquote>
                </>
              )}

              <h2 className="mb-2 mt-6 font-semibold">Ingredients</h2>
              {selectedMod ? (
                <DiffList original={recipe.original.ingredients} modified={selectedMod.modifiedIngredients} />
              ) : (
                <ul className="space-y-1 text-sm">
                  {recipe.original.ingredients.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              )}

              <h2 className="mb-2 mt-6 font-semibold">Instructions</h2>
              {selectedMod ? (
                <DiffList original={recipe.original.instructions} modified={selectedMod.modifiedInstructions} />
              ) : (
                <ul className="space-y-1 text-sm">
                  {recipe.original.instructions.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
