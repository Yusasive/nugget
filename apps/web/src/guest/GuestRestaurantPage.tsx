import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { PaginatedResponse, MenuItemDto } from '@nugget/shared-types';

const FALLBACK_MENU: { category: string; items: { name: string; description: string; price: number }[] }[] = [
  {
    category: 'Starters',
    items: [
      { name: 'Suya Skewers', description: 'Spiced grilled beef skewers with groundnut sauce and sliced onions.', price: 3500 },
      { name: 'Kilishi Platter', description: 'Thin-sliced dried spiced beef, a Northern Nigerian delicacy.', price: 4000 },
      { name: 'Pepper Soup', description: 'Aromatic goat meat pepper soup with traditional spices.', price: 3000 },
    ],
  },
  {
    category: 'Main Courses',
    items: [
      { name: 'Tuwo Shinkafa', description: 'Smooth rice pudding served with miyan kuka or miyan taushe.', price: 5500 },
      { name: 'Jollof Rice & Grilled Chicken', description: 'Smoky party-style jollof rice with a half grilled chicken.', price: 6500 },
      { name: 'Masa & Miyan Taushe', description: 'Fried rice cakes with pumpkin leaf soup and groundnut.', price: 4500 },
      { name: 'Grilled Tilapia', description: 'Whole tilapia marinated in local spices, served with fried plantain.', price: 7500 },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Fura da Nono', description: 'Chilled fermented milk with millet balls — a refreshing classic.', price: 2000 },
      { name: 'Zobo Sorbet', description: 'House-made hibiscus sorbet with a hint of ginger.', price: 2500 },
    ],
  },
  {
    category: 'Drinks',
    items: [
      { name: 'Zobo (Hibiscus Drink)', description: 'Chilled hibiscus flower drink with ginger and cloves.', price: 1500 },
      { name: 'Kunu Aya', description: 'Tiger nut milk, lightly sweetened and spiced.', price: 1500 },
      { name: 'Fresh Tamarind Juice', description: 'Tangy and refreshing, made fresh daily.', price: 1500 },
    ],
  },
];

export function GuestRestaurantPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['public-menu'],
    queryFn: () => api.get<PaginatedResponse<MenuItemDto>>('/menu/items?pageSize=100'),
    retry: false,
  });

  // Group API items by category if available, else use fallback
  const menuData = (() => {
    const items = data?.data;
    if (!items?.length) return FALLBACK_MENU;
    const map = new Map<string, typeof FALLBACK_MENU[0]['items']>();
    for (const item of items) {
      const cat = item.category?.name ?? 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ name: item.name, description: item.description ?? '', price: Number(item.price) });
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  })();

  const categories = menuData.map(m => m.category);
  const filtered = activeCategory
    ? menuData.filter(m => m.category === activeCategory)
    : menuData;

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Dining</p>
          <h1 className="guest-page-title">The Continental Kitchen</h1>
          <p>Authentic Northern Nigerian cuisine, elevated with care and craft.</p>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner">
          <div className="guest-menu-tabs">
            <button
              className={`guest-menu-tab${activeCategory === null ? ' active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`guest-menu-tab${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.map(section => (
            <div key={section.category} className="guest-menu-section">
              <h2 className="guest-menu-category">{section.category}</h2>
              <div className="guest-menu-grid">
                {section.items.map(item => (
                  <div key={item.name} className="guest-menu-item">
                    <div className="guest-menu-item-body">
                      <h3>{item.name}</h3>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <span className="guest-menu-price">₦{Number(item.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
