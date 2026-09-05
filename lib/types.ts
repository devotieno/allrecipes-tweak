export interface Recipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  url: string;
}

export interface Tweak {
  id: string;
  author: string;
  text: string;
}

export interface ModifiedRecipe {
  tweakId: string;
  author: string;
  tweakText: string;
  modifiedIngredients: string[];
  modifiedInstructions: string[];
  success: boolean;
}

export interface StoredRecipe {
  id: string;
  url: string;
  original: Recipe;
  tweaks: Tweak[];
  modifications: ModifiedRecipe[];
  createdAt: string;
}

export interface RecipeSummary {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}
