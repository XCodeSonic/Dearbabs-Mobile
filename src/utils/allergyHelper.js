
// src/utils/allergyHelper.js
// ⭐ Single source of truth for matching a customer's allergies
//    against a menu item's declared allergens.

/**
 * Normalize any allergen value (string, array, or object) into a
 * lowercase array of slugs. Matches the `food_allergens` Setting IDs.
 */
export const normalizeAllergenList = (raw) => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') return v.id || v.slug || v.name || '';
        return '';
      })
      .map((v) => String(v).toLowerCase().trim())
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((v) => v.toLowerCase().trim())
      .filter(Boolean);
  }

  return [];
};

/**
 * Return the list of allergens that BOTH the customer has selected
 * AND the menu item contains.
 *
 * @param {object} menuItem  Menu item from the API (has `allergens_array` or `allergens`).
 * @param {string[]} customerAllergies  Customer's selected allergen slugs.
 * @returns {string[]} Array of matched slugs (lowercase).
 */
export const getMatchingAllergies = (menuItem, customerAllergies) => {
  if (!menuItem || !Array.isArray(customerAllergies) || customerAllergies.length === 0) {
    return [];
  }

  const itemAllergens = normalizeAllergenList(
    menuItem.allergens_array ?? menuItem.allergens
  );

  if (itemAllergens.length === 0) return [];

  const normalizedCustomer = customerAllergies
    .map((a) => String(a).toLowerCase().trim())
    .filter(Boolean);

  return itemAllergens.filter((a) => normalizedCustomer.includes(a));
};

/**
 * Pretty-print a slug for UI: "tree_nuts" → "Tree Nuts".
 */
export const humanizeAllergen = (slug) => {
  if (!slug) return '';
  return String(slug)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};