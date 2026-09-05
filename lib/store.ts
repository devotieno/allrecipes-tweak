import fs from 'fs';
import path from 'path';
import { StoredRecipe, RecipeSummary } from './types';

// NOTE: this is a flat-file JSON store, on purpose -- it's the scrappiest
// thing that works for a single-instance app on Railway. It persists across
// requests as long as the container keeps running, but a fresh deploy wipes
// it (no volume attached). Good enough for this project; swap for a real DB
// if you need data to survive redeploys.

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf-8');
}

function readDb(): StoredRecipe[] {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeDb(data: StoredRecipe[]) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function listRecipes(): RecipeSummary[] {
  return readDb()
    .map((r) => ({ id: r.id, url: r.url, title: r.original.title, createdAt: r.createdAt }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getRecipeById(id: string): StoredRecipe | undefined {
  return readDb().find((r) => r.id === id);
}

export function getRecipeByUrl(url: string): StoredRecipe | undefined {
  return readDb().find((r) => r.url === url);
}

export function saveRecipe(recipe: StoredRecipe) {
  const db = readDb();
  db.unshift(recipe);
  writeDb(db);
}

export function deleteRecipeById(id: string): boolean {
  const db = readDb();
  const next = db.filter((r) => r.id !== id);
  const changed = next.length !== db.length;
  if (changed) writeDb(next);
  return changed;
}