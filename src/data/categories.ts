export type Category = 'bolos' | 'doces' | 'salgados';

export type CategoryOption = {
  value: Category;
  label: string;
  iconLibrary: 'MaterialCommunityIcons' | 'Ionicons';
  iconName: string;
};

export const CATEGORIES: CategoryOption[] = [
  {
    value: 'bolos',
    label: 'Bolos',
    iconLibrary: 'MaterialCommunityIcons',
    iconName: 'cake-variant-outline',
  },
  {
    value: 'doces',
    label: 'Doces',
    iconLibrary: 'Ionicons',
    iconName: 'ice-cream-outline',
  },
  {
    value: 'salgados',
    label: 'Salgados',
    iconLibrary: 'Ionicons',
    iconName: 'fast-food-outline',
  },
];

export function parseCategory(raw: unknown): Category | null {
  return raw === 'bolos' || raw === 'doces' || raw === 'salgados' ? raw : null;
}
