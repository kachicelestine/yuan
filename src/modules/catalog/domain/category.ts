/** A shelf of the marketplace, e.g. "energy". Lower-case slug, stable forever. */
export type CategoryId = string & { readonly __brand: "CategoryId" };

export type Category = Readonly<{
  id: CategoryId;
  label: string;
  image: string;
  hero: string;
  blurb: string;
  subcategories: readonly string[];
  /** Order on the category page. */
  position: number;
}>;
