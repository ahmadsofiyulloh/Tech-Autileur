export const CONTENT_VARIANT_KEYS = [
  "hero_hook",
  "problem_solution",
  "detail_proof",
  "use_case",
  "price_value",
] as const;

export type ContentVariantKey = (typeof CONTENT_VARIANT_KEYS)[number];

export type ContentVariant = {
  key: ContentVariantKey;
  label: string;
  description: string;
  storyGoal: string;
  hookStrategy: string;
  sourcePriority: string;
};

const GROUNDED_SOURCE_PRIORITY =
  "VO and copy must be grounded in reviewed metadata, marketplace source data, product title, product description, selling_angle, use_case, pain_point, and visual description.";

export const CONTENT_VARIANTS = {
  hero_hook: {
    key: "hero_hook",
    label: "Hero Hook",
    description: "A complete prompt pack focused on the strongest first-impression product hook.",
    storyGoal: "Make the product immediately recognizable and worth stopping for in the first seconds.",
    hookStrategy: "Lead with the most visually clear product benefit, then turn it into a direct curiosity or desire hook.",
    sourcePriority: GROUNDED_SOURCE_PRIORITY,
  },
  problem_solution: {
    key: "problem_solution",
    label: "Problem Solution",
    description: "A complete prompt pack that frames the product as the answer to a concrete buyer problem.",
    storyGoal: "Connect the product to a specific pain point and show the relief or improvement it creates.",
    hookStrategy: "Open with the problem the viewer recognizes, then pivot quickly to the product-led solution.",
    sourcePriority: GROUNDED_SOURCE_PRIORITY,
  },
  detail_proof: {
    key: "detail_proof",
    label: "Detail Proof",
    description: "A complete prompt pack that uses product details and proof points to build confidence.",
    storyGoal: "Show why the product is credible by emphasizing visible details, materials, features, or evidence.",
    hookStrategy: "Start on a concrete detail that can be seen or verified, then connect it to the buying reason.",
    sourcePriority: GROUNDED_SOURCE_PRIORITY,
  },
  use_case: {
    key: "use_case",
    label: "Use Case",
    description: "A complete prompt pack centered on a realistic product use scenario.",
    storyGoal: "Help the viewer picture where, when, and why they would use the product.",
    hookStrategy: "Begin with a familiar usage moment, then make the product the practical choice inside that moment.",
    sourcePriority: GROUNDED_SOURCE_PRIORITY,
  },
  price_value: {
    key: "price_value",
    label: "Price Value",
    description: "A complete prompt pack that highlights the product's perceived value and purchase logic.",
    storyGoal: "Make the offer feel worthwhile by tying the product benefits to value, affordability, or smart buying.",
    hookStrategy: "Open with a value-oriented reason to care, then support it with grounded benefit and product evidence.",
    sourcePriority: GROUNDED_SOURCE_PRIORITY,
  },
} as const satisfies Record<ContentVariantKey, ContentVariant>;

function normalizePromptCodeSegment(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

export function isContentVariantKey(value: string): value is ContentVariantKey {
  return (CONTENT_VARIANT_KEYS as readonly string[]).includes(value);
}

export function getContentVariant(value: string) {
  return isContentVariantKey(value) ? CONTENT_VARIANTS[value] : null;
}

export function buildContentVariantPromptCode(productCode: string, variantKey: string) {
  const normalizedProductCode = normalizePromptCodeSegment(productCode);
  const normalizedVariantKey = normalizePromptCodeSegment(variantKey);

  return `PROMPT-${normalizedProductCode}-${normalizedVariantKey}`;
}
