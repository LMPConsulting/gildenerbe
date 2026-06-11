import { RECIPES, RECIPE_ORDER, buffValue } from '../data/foods.js';
import { hasMats, consumeMats } from './materials.js';

const ensure = (account) => {
  if (!Array.isArray(account.fishpond)) account.fishpond = [];
  if (!Array.isArray(account.larder)) account.larder = [];
  if (!('pendingFood' in account)) account.pendingFood = null;
};

let uid = 1;

// Eligible pond fish for a recipe, cheapest first — cooking always consumes
// the worst fish that still qualify, so good catches stay for better dishes.
function eligibleFish(account, recipe) {
  return (account.fishpond || [])
    .filter((f) => f.quality >= recipe.minQuality)
    .sort((a, b) => a.quality - b.quality || a.value - b.value);
}

export function canCook(account, recipeId) {
  const r = RECIPES[recipeId];
  if (!r) return false;
  if (eligibleFish(account, r).length < r.fishCount) return false;
  if (r.herbs > 0 && (!account.materials || !hasMats(account.materials, { kraeuter: r.herbs }))) return false;
  return true;
}

// All recipes the account can cook right now, in display order.
export function cookableRecipes(account) {
  return RECIPE_ORDER.map((id) => RECIPES[id]).filter((r) => canCook(account, r.id));
}

// Cooks a recipe: consumes fishCount eligible fish (worst first) + herbs and
// pushes the dish into the larder. The buff scales with the average quality of
// the consumed fish; a lucky chef (15%) gets one bonus serving.
// Returns the food, or null when ingredients are missing.
export function cook(account, recipeId, rng) {
  ensure(account);
  const r = RECIPES[recipeId];
  if (!r || !canCook(account, recipeId)) return null;

  const used = eligibleFish(account, r).slice(0, r.fishCount);
  for (const f of used) account.fishpond.splice(account.fishpond.indexOf(f), 1);
  if (r.herbs > 0) consumeMats(account.materials, { kraeuter: r.herbs });

  const avgQ = used.reduce((s, f) => s + f.quality, 0) / used.length;
  const perfect = !!(rng && rng.chance(0.15));
  const food = {
    id: `food-${recipeId}-${uid++}`,
    recipeId,
    name: r.name,
    buff: { stat: r.stat, value: buffValue(r, avgQ) },
    servings: r.servings + (perfect ? 1 : 0),
    runs: r.runs || 1,
    perfect,
  };
  while (account.larder.some((f) => f.id === food.id)) food.id += 'x';
  account.larder.push(food);
  return food;
}

// Eats one serving: sets account.pendingFood (the orchestrator feeds it to the
// next hero) and removes the dish once its servings are gone.
export function eat(account, foodId) {
  ensure(account);
  const food = account.larder.find((f) => f.id === foodId);
  if (!food || food.servings <= 0) return false;
  food.servings -= 1;
  if (food.servings <= 0) account.larder = account.larder.filter((f) => f !== food);
  account.pendingFood = {
    stat: food.buff.stat,
    value: food.buff.value,
    label: food.name,
    runsLeft: food.runs || 1,
  };
  return true;
}
