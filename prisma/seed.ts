/**
 * Database seed.
 *   npm run db:seed                 → RBAC, settings, Super Admin (from env) and demo content
 *   SEED_DEMO=false npm run db:seed → everything except demo catalog/customers/orders (production)
 *
 * The Super Admin is created from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Nothing is hardcoded.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { OrderStatus } from "../src/generated/prisma/enums";
import { computeTotals, resolvePrice } from "../src/lib/pricing";
import { slugify } from "../src/lib/slug";
import { defaultSettings } from "../src/lib/validations/settings";
import { seedRbac, upsertSuperAdmin } from "./seed/rbac";
import { BRANDS, CATEGORIES, IMG, img, PRODUCTS } from "./seed/catalog-data";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Deterministic RNG so demo data is reproducible.
let rngState = 20261124;
const rand = () => {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000);

async function seedSettings() {
  const defaults = defaultSettings();
  defaults.social = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    pinterest: "https://pinterest.com/",
    youtube: "",
    tiktok: "",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.websiteSetting.upsert({ where: { key }, create: { key, value: value as object }, update: {} });
  }
}

async function seedShipping() {
  if (await prisma.shippingZone.count()) return;
  await prisma.shippingZone.create({
    data: {
      name: "Inside Dhaka City",
      districts: ["Dhaka"],
      sortOrder: 0,
      methods: {
        create: [
          { name: "Standard Delivery", description: "Delivered by our city courier partner.", fee: 70, minDays: 1, maxDays: 2, sortOrder: 0 },
          { name: "Express (Same Day)", description: "Order before 12pm for same-day delivery.", fee: 150, minDays: 0, maxDays: 1, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.shippingZone.create({
    data: {
      name: "Dhaka Suburbs",
      districts: ["Gazipur", "Narayanganj", "Munshiganj", "Manikganj", "Narsingdi"],
      sortOrder: 1,
      methods: { create: [{ name: "Standard Delivery", fee: 100, minDays: 2, maxDays: 3 }] },
    },
  });
  await prisma.shippingZone.create({
    data: {
      name: "Rest of Bangladesh",
      isDefault: true,
      sortOrder: 2,
      methods: {
        create: [
          { name: "Standard Delivery", description: "Nationwide courier.", fee: 130, minDays: 3, maxDays: 5, sortOrder: 0 },
          { name: "Express Delivery", fee: 250, minDays: 2, maxDays: 3, sortOrder: 1, codAvailable: false },
        ],
      },
    },
  });
}

async function seedCatalog() {
  const brandIds = new Map<string, string>();
  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({ where: { slug: b.slug }, create: b, update: {} });
    brandIds.set(b.slug, brand.id);
  }

  const categoryIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, imageUrl: img(IMG[c.image], 900), sortOrder: i },
      update: {},
    });
    categoryIds.set(c.slug, parent.id);
    for (const [j, child] of c.children.entries()) {
      const sub = await prisma.category.upsert({
        where: { slug: child.slug },
        create: { slug: child.slug, name: child.name, parentId: parent.id, sortOrder: j, imageUrl: img(IMG[child.image], 600) },
        update: {},
      });
      categoryIds.set(child.slug, sub.id);
    }
  }

  const attributeIds = new Map<string, string>();
  const attrNames = [...new Set(PRODUCTS.flatMap((p) => Object.keys(p.attributes)))];
  for (const [i, name] of attrNames.entries()) {
    const a = await prisma.productAttribute.upsert({
      where: { name },
      create: { name, slug: slugify(name), sortOrder: i },
      update: {},
    });
    attributeIds.set(name, a.id);
  }

  const categoryCodes = new Map<string, number>();
  for (const [index, p] of PRODUCTS.entries()) {
    const slug = slugify(p.name);
    if (await prisma.product.findUnique({ where: { slug } })) continue;
    const catId = categoryIds.get(p.category);
    if (!catId) throw new Error(`Unknown category ${p.category}`);
    const code = (categoryCodes.get(p.category) ?? 0) + 1;
    categoryCodes.set(p.category, code);
    // e.g. EZ-M-SUN-001 (gender · product type · sequence)
    const [gender, type] = p.category.split("-");
    const sku = `EZ-${gender[0].toUpperCase()}-${type.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
    const effective = resolvePrice({ price: p.price, salePrice: p.salePrice }).effective;
    const variants = p.variants ?? [{ stock: p.stock ?? 0 }];
    const hasVariants = Boolean(p.variants);

    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        sku,
        categoryId: catId,
        brandId: brandIds.get(p.brand)!,
        shortDescription: p.short,
        description: p.description,
        price: p.price,
        salePrice: p.salePrice ?? null,
        costPrice: p.cost,
        effectivePrice: effective.toFixed(2),
        stockQuantity: variants.reduce((n, v) => n + v.stock, 0),
        weightGrams: p.weight ?? null,
        dimensions: p.dimensions ?? null,
        tags: p.tags,
        isFeatured: Boolean(p.featured),
        status: "ACTIVE",
        hasVariants,
        seoTitle: `${p.name} | Ezyza`,
        seoDescription: p.short,
        publishedAt: daysAgo(Math.floor(rand() * 150)),
        createdAt: daysAgo(Math.floor(rand() * 150) + 5),
        images: {
          create: p.images.map((key, i) => ({ url: img(IMG[key]), alt: i === 0 ? p.name : `${p.name} — detail`, sortOrder: i })),
        },
        attributes: {
          create: Object.entries(p.attributes).map(([name, value]) => ({ attributeId: attributeIds.get(name)!, value })),
        },
        extraCategories: p.alsoIn?.length
          ? { create: p.alsoIn.map((slug) => ({ categoryId: categoryIds.get(slug)! })) }
          : undefined,
      },
    });

    for (const [vi, v] of variants.entries()) {
      const label = [v.color, v.size].filter(Boolean).join(" / ") || "Default";
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: hasVariants ? `${sku}-${slugify(label).toUpperCase().replace(/-/g, "")}` : sku,
          name: label,
          color: v.color ?? null,
          colorHex: v.colorHex ?? null,
          size: v.size ?? null,
          price: v.price ?? null,
          salePrice: v.salePrice ?? null,
          isDefault: vi === 0,
          sortOrder: vi,
          inventory: { create: { quantity: v.stock, lowStockThreshold: 5 } },
        },
        include: { inventory: true },
      });
      await prisma.stockMovement.create({
        data: {
          inventoryId: variant.inventory!.id,
          type: "INITIAL",
          quantityChange: v.stock,
          quantityAfter: v.stock,
          reason: "Opening stock",
          createdAt: product.createdAt,
        },
      });
    }
  }
}

async function seedCollections() {
  if (await prisma.collection.count()) return;
  const products = await prisma.product.findMany({ select: { id: true, slug: true } });
  const id = (slug: string) => products.find((p) => p.slug === slug)?.id;
  const collections = [
    {
      name: "Summer Essentials",
      slug: "summer-essentials",
      description: "Shades, shorts and breezy shirts for Bangladesh's hottest months.",
      image: IMG.womanTeeShorts,
      products: ["classic-wayfarer-sunglasses", "distressed-denim-shorts", "pique-cotton-polo", "cross-strap-platform-sandals", "loopback-sweat-shorts", "tie-dye-oversized-shirt"],
    },
    {
      name: "Office Ready",
      slug: "office-ready",
      description: "Crisp shirts, polished shoes and leather that means business.",
      image: IMG.manSuit,
      products: ["crisp-white-formal-shirt", "oxford-button-down-shirt", "leather-oxford-brogues", "full-grain-leather-belt", "pastel-poplin-shirt", "teal-satchel-bag"],
    },
    {
      name: "Weekend Getaway",
      slug: "weekend-getaway",
      description: "Carry-alls and easy pieces for trips to Cox's Bazar and beyond.",
      image: IMG.bagWicker,
      products: ["wicker-basket-bag", "everyday-commuter-backpack", "round-metal-sunglasses", "minimal-leather-sneakers", "classic-denim-shorts"],
    },
    {
      name: "Gifts Under ৳3,000",
      slug: "gifts-under-3000",
      description: "Thoughtful presents for him and her that don't overthink the budget.",
      image: IMG.walletHand,
      products: ["bifold-leather-wallet", "slim-card-holder", "full-grain-leather-belt", "cat-eye-sunglasses", "compact-leather-purse", "slim-waist-belt"],
    },
  ];
  for (const [i, c] of collections.entries()) {
    await prisma.collection.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: img(c.image, 1000),
        isFeatured: true,
        sortOrder: i,
        products: {
          create: c.products
            .map((s, k) => ({ productId: id(s), sortOrder: k }))
            .filter((x): x is { productId: string; sortOrder: number } => Boolean(x.productId)),
        },
      },
    });
  }
}

async function seedContent(authorId: string | null) {
  if (!(await prisma.banner.count())) {
    await prisma.banner.createMany({
      data: [
        {
          title: "Own the everyday",
          subtitle: "Shirts, leather and footwear for men — made to look sharp from Monday to the weekend.",
          eyebrow: "New season · Men",
          imageUrl: img(IMG.heroMen, 2000),
          ctaLabel: "Shop men",
          ctaHref: "/categories/men",
          placement: "HERO",
          sortOrder: 0,
        },
        {
          title: "Effortless, every day",
          subtitle: "Statement bags, easy shirts and shoes you'll reach for again and again.",
          eyebrow: "New season · Women",
          imageUrl: img(IMG.heroWomen, 2000),
          ctaLabel: "Shop women",
          ctaHref: "/categories/women",
          placement: "HERO",
          sortOrder: 1,
        },
        {
          title: "Made for the sun",
          subtitle: "UV400 sunglasses for men and women — polarised, lightweight and built to last.",
          eyebrow: "Sunglasses edit",
          imageUrl: img(IMG.womanGingham, 2000),
          ctaLabel: "Shop sunglasses",
          ctaHref: "/products?type=sunglasses",
          placement: "HERO",
          sortOrder: 2,
        },
        {
          title: "Up to 20% off bags, shoes & shirts",
          subtitle: "Seasonal favourites at their best prices. Limited stock — while it lasts.",
          eyebrow: "The sale",
          imageUrl: img(IMG.promoShopping, 1800),
          ctaLabel: "Shop the sale",
          ctaHref: "/products?onSale=1",
          placement: "PROMO",
          sortOrder: 0,
        },
      ],
    });
  }

  if (!(await prisma.homepageSection.count())) {
    const sections = [
      { key: "hero", type: "hero", title: "Hero banners", config: {} },
      { key: "categories", type: "categories", title: "Shop by department", subtitle: "Everything you need, for him and for her.", config: { limit: 2 } },
      { key: "trending", type: "products", title: "Trending now", subtitle: "What Dhaka is wearing this month.", config: { source: "trending", limit: 8 } },
      { key: "promo", type: "promo", title: "Promotional banner", config: {} },
      { key: "best_sellers", type: "products", title: "Best sellers", subtitle: "Tried, tested and reordered.", config: { source: "best_sellers", limit: 8 } },
      { key: "collections", type: "collections", title: "Shop the edit", subtitle: "Curated looks for every plan.", config: { limit: 4 } },
      { key: "new_arrivals", type: "products", title: "New arrivals", subtitle: "Fresh drops, just landed.", config: { source: "new_arrivals", limit: 8 } },
      {
        key: "story",
        type: "story",
        title: "Style made easy",
        config: {
          eyebrow: "About Ezyza",
          body: "Ezyza started with a simple idea: looking good shouldn't be complicated. We design sunglasses, footwear, bags, leather goods and everyday clothing for men and women — pieces that work together, wear well in our climate and are priced fairly. Every order is packed in Dhaka and delivered across Bangladesh, with cash on delivery and easy 14-day returns.",
          imageUrl: img(IMG.storeRack, 1400),
          ctaLabel: "Our story",
          ctaHref: "/about",
        },
      },
      { key: "testimonials", type: "testimonials", title: "Loved by our customers", subtitle: "Reviews from across Bangladesh.", config: {} },
      { key: "newsletter", type: "newsletter", title: "Newsletter", config: {} },
      {
        key: "instagram",
        type: "instagram",
        title: "@ezyza.bd",
        subtitle: "Tag #EzyzaStyle to be featured.",
        config: {
          handle: "ezyza.bd",
          url: "https://instagram.com/",
          images: [IMG.manLeather, IMG.womanRoundSun, IMG.flatlayMen2, IMG.womanTeeShorts, IMG.manCoat, IMG.flatlayWomen].map((i) => img(i, 600)),
        },
      },
    ];
    for (const [i, s] of sections.entries()) {
      await prisma.homepageSection.create({ data: { ...s, sortOrder: i, config: s.config as object } });
    }
  }

  if (!(await prisma.testimonial.count())) {
    await prisma.testimonial.createMany({
      data: [
        { name: "Nusrat J.", location: "Dhaka", quote: "The croc-embossed handbag looks far more expensive than it was. Delivered next day and the packaging was beautiful.", rating: 5, sortOrder: 0 },
        { name: "Tanvir A.", location: "Chattogram", quote: "Bought the Oxford shirt in two colours and the leather belt. Perfect fit, great fabric — I'm ordering again.", rating: 5, sortOrder: 1 },
        { name: "Farhana R.", location: "Sylhet", quote: "Love my cat-eye sunglasses! Cash on delivery made it easy, and exchanging a size was hassle-free.", rating: 5, sortOrder: 2 },
      ],
    });
  }

  if (!(await prisma.blogPost.count())) {
    const style = await prisma.blogCategory.create({ data: { name: "Style Guide", slug: "style-guide" } });
    const care = await prisma.blogCategory.create({ data: { name: "Care", slug: "care" } });
    const posts = [
      {
        title: "How to choose sunglasses for your face shape",
        slug: "how-to-choose-sunglasses-for-your-face-shape",
        excerpt: "Round, square, oval or heart — a quick guide to frames that flatter.",
        categoryId: style.id,
        cover: IMG.womanRoundSun,
        tags: ["sunglasses", "style"],
        content:
          "<p>The right pair of sunglasses balances your features. The simplest rule: choose a frame shape that contrasts with your face shape.</p><h2>Round faces</h2><p>Angular frames like wayfarers and square styles add definition. Avoid very small round frames.</p><h2>Square faces</h2><p>Soften strong jawlines with round, oval or aviator frames.</p><h2>Oval faces</h2><p>Lucky you — almost everything works. Try oversized or cat-eye frames for drama.</p><h2>Heart-shaped faces</h2><p>Frames that are wider at the bottom, like aviators or light rimless styles, balance a wider forehead.</p><h2>Always check the lens</h2><p>Look for UV400 protection — every pair at Ezyza has it — and choose polarised lenses if you drive or spend time near water.</p>",
      },
      {
        title: "How to care for leather shoes, belts and bags",
        slug: "how-to-care-for-leather-shoes-belts-and-bags",
        excerpt: "Five minutes a month keeps your leather looking new for years — even through monsoon.",
        categoryId: care.id,
        cover: IMG.oxford,
        tags: ["leather", "care"],
        content:
          "<p>Good leather gets better with age — if you look after it. Here's our simple routine.</p><h2>Clean gently</h2><p>Wipe off dust with a soft, dry cloth after wearing. For marks, use a barely damp cloth and let it air-dry away from direct sun or heat.</p><h2>Condition every month</h2><p>Apply a small amount of leather balm in circular motions and buff. This keeps leather supple and stops it cracking in dry winter air.</p><h2>Monsoon tips</h2><p>If shoes get soaked, stuff them with newspaper and let them dry naturally — never on a heater. Rotate pairs so each one dries fully.</p><h2>Store it right</h2><p>Keep bags stuffed with tissue in a breathable dust bag, and hang belts or roll them loosely.</p>",
      },
      {
        title: "Capsule wardrobe: 10 pieces for him and her",
        slug: "capsule-wardrobe-10-pieces-for-him-and-her",
        excerpt: "Build a wardrobe that works harder with fewer, better pieces.",
        categoryId: style.id,
        cover: IMG.clothesRack,
        tags: ["wardrobe", "style"],
        content:
          "<p>A capsule wardrobe is a small set of versatile pieces that all work together. Here's where we'd start.</p><h2>For him</h2><p>A white formal shirt, a blue Oxford, a dark polo, denim shorts, minimal white sneakers, brown brogues, a leather belt, a bifold wallet, a backpack and a classic pair of wayfarers.</p><h2>For her</h2><p>A white tee, a pastel poplin shirt, high-rise denim shorts, nude pumps, white sneakers, ankle boots, a structured top-handle bag, a slim waist belt, a compact purse and cat-eye sunglasses.</p><blockquote>Buy fewer things, choose them well, and wear them often.</blockquote><p>Start with the pieces you'll wear most this month — then build from there.</p>",
      },
    ];
    for (const [i, p] of posts.entries()) {
      await prisma.blogPost.create({
        data: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          content: p.content,
          coverImageUrl: img(p.cover, 1600),
          categoryId: p.categoryId,
          authorId,
          tags: p.tags,
          status: "PUBLISHED",
          publishedAt: daysAgo(30 - i * 9),
          seoTitle: p.title,
          seoDescription: p.excerpt,
        },
      });
    }
  }

  if (!(await prisma.coupon.count())) {
    const footwear = await prisma.category.findMany({ where: { slug: { in: ["men-footwear", "women-footwear"] } } });
    await prisma.coupon.create({
      data: { code: "WELCOME10", description: "10% off your first order", type: "PERCENTAGE", value: 10, minPurchase: 2000, maxDiscount: 1500, perCustomerLimit: 1 },
    });
    await prisma.coupon.create({
      data: { code: "FLAT500", description: "৳500 off orders over ৳4,000", type: "FIXED", value: 500, minPurchase: 4000, usageLimit: 200 },
    });
    await prisma.coupon.create({
      data: { code: "FREESHIP", description: "Free delivery, no minimum", type: "FREE_SHIPPING", value: 0, expiresAt: daysAgo(-60) },
    });
    await prisma.coupon.create({
      data: {
        code: "STEP15",
        description: "15% off all footwear",
        type: "PERCENTAGE",
        value: 15,
        categories: { connect: footwear.map((c) => ({ id: c.id })) },
      },
    });
    await prisma.coupon.create({
      data: { code: "SUMMER20", description: "Expired summer promotion", type: "PERCENTAGE", value: 20, expiresAt: daysAgo(30), isActive: true },
    });
  }
}

const CUSTOMERS = [
  { name: "Ayesha Rahman", email: "ayesha@example.com", phone: "01711000001", division: "Dhaka", district: "Dhaka", area: "Dhanmondi" },
  { name: "Tanvir Ahmed", email: "tanvir@example.com", phone: "01811000002", division: "Chattogram", district: "Chattogram", area: "Khulshi" },
  { name: "Nusrat Jahan", email: "nusrat@example.com", phone: "01911000003", division: "Dhaka", district: "Dhaka", area: "Gulshan" },
  { name: "Rafiq Hossain", email: "rafiq@example.com", phone: "01611000004", division: "Sylhet", district: "Sylhet", area: "Zindabazar" },
  { name: "Farhana Islam", email: "farhana@example.com", phone: "01511000005", division: "Dhaka", district: "Gazipur", area: "Tongi" },
  { name: "Imran Chowdhury", email: "imran@example.com", phone: "01311000006", division: "Rajshahi", district: "Rajshahi", area: "Shaheb Bazar" },
];

async function seedCustomersAndOrders() {
  if (await prisma.order.count()) return;
  const passwordHash = await bcrypt.hash("Customer#2026", 12);
  const users = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        name: c.name,
        phone: c.phone,
        passwordHash,
        emailVerifiedAt: new Date(),
        createdAt: daysAgo(150 - i * 20),
        addresses: {
          create: {
            label: "Home",
            fullName: c.name,
            phone: c.phone,
            line1: `House ${10 + i}, Road ${3 + i}`,
            area: c.area,
            district: c.district,
            division: c.division,
            isDefault: true,
          },
        },
      },
      update: {},
    });
    users.push({ ...user, ...c });
  }

  const variants = await prisma.productVariant.findMany({
    include: { product: true },
  });
  const statuses: OrderStatus[] = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "PROCESSING", "CONFIRMED", "PENDING", "CANCELLED", "PACKED", "OUT_FOR_DELIVERY"];
  const settings = defaultSettings();

  for (let n = 0; n < 42; n++) {
    const age = Math.floor((n / 42) * 120); // spread across ~4 months
    const placedAt = daysAgo(120 - age, Math.floor(rand() * 20));
    const recent = 120 - age < 6;
    const status: OrderStatus = recent ? pick(["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED"] as OrderStatus[]) : pick(statuses);
    const guest = rand() < 0.2;
    const customer = pick(users);
    const lineCount = 1 + Math.floor(rand() * 3);
    const lines = new Map<string, { variant: (typeof variants)[number]; qty: number }>();
    for (let k = 0; k < lineCount; k++) {
      const v = pick(variants);
      lines.set(v.id, { variant: v, qty: 1 + Math.floor(rand() * 2) });
    }
    const priced = [...lines.values()].map(({ variant, qty }) => {
      const price = resolvePrice(variant.product, variant);
      return { variant, qty, unit: price.effective };
    });
    const sub = computeTotals({ lines: priced.map((p) => ({ unitPrice: p.unit, quantity: p.qty })) }).subtotal;
    const inDhaka = customer.district === "Dhaka";
    const shipping = sub.gte(settings.commerce.freeShippingThreshold) ? 0 : inDhaka ? 70 : 130;
    const totals = computeTotals({ lines: priced.map((p) => ({ unitPrice: p.unit, quantity: p.qty })), shipping });
    const paid = status === "DELIVERED";
    const ymd = placedAt.toISOString().slice(2, 10).replace(/-/g, "");
    const orderNumber = `EZY-${ymd}-${String(1000 + n)}`;
    const flow: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
    const history: OrderStatus[] =
      status === "CANCELLED" ? ["PENDING", "CANCELLED"] : flow.slice(0, flow.indexOf(status) + 1);

    await prisma.order.create({
      data: {
        orderNumber,
        userId: guest ? null : customer.id,
        status,
        paymentStatus: paid ? "PAID" : status === "CANCELLED" ? "CANCELLED" : "UNPAID",
        paymentMethod: "COD",
        subtotal: totals.subtotal,
        shippingTotal: totals.shipping,
        grandTotal: totals.total,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        shipFullName: customer.name,
        shipPhone: customer.phone,
        shipLine1: `House ${10 + n % 9}, Road ${n % 12}`,
        shipArea: customer.area,
        shipDistrict: customer.district,
        shipDivision: customer.division,
        shippingMethodName: "Standard Delivery",
        estimatedDelivery: inDhaka ? "1–2 business days" : "3–5 business days",
        idempotencyKey: `seed-${n}`,
        stockRestored: status === "CANCELLED",
        trackingNumber: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status) ? `PTH${100000 + n}` : null,
        courier: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status) ? "Pathao Courier" : null,
        placedAt,
        confirmedAt: history.includes("CONFIRMED") ? new Date(placedAt.getTime() + 3_600_000) : null,
        shippedAt: history.includes("SHIPPED") ? new Date(placedAt.getTime() + 86_400_000) : null,
        deliveredAt: status === "DELIVERED" ? new Date(placedAt.getTime() + 3 * 86_400_000) : null,
        cancelledAt: status === "CANCELLED" ? new Date(placedAt.getTime() + 7_200_000) : null,
        items: {
          create: priced.map((p) => ({
            productId: p.variant.productId,
            variantId: p.variant.id,
            productName: p.variant.product.name,
            variantName: p.variant.name === "Default" ? null : p.variant.name,
            sku: p.variant.sku,
            unitPrice: p.unit.toFixed(2),
            unitCost: p.variant.product.costPrice,
            quantity: p.qty,
            lineTotal: p.unit.times(p.qty).toFixed(2),
          })),
        },
        statusHistory: {
          create: history.map((s, i) => ({
            fromStatus: i === 0 ? null : history[i - 1],
            toStatus: s,
            note: i === 0 ? "Order placed" : null,
            createdAt: new Date(placedAt.getTime() + i * 12 * 3_600_000),
          })),
        },
        payments: {
          create: {
            method: "COD",
            status: paid ? "PAID" : status === "CANCELLED" ? "CANCELLED" : "UNPAID",
            amount: totals.total,
            provider: "cod",
            paidAt: paid ? new Date(placedAt.getTime() + 3 * 86_400_000) : null,
            createdAt: placedAt,
            transactions: paid
              ? { create: { type: "COD_COLLECTION", status: "succeeded", amount: totals.total, message: "Cash collected on delivery" } }
              : undefined,
          },
        },
      },
    });
  }

  // Denormalized sales counts.
  const sold = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: "CANCELLED" } }, productId: { not: null } },
    _sum: { quantity: true },
  });
  for (const s of sold) {
    await prisma.product.update({ where: { id: s.productId! }, data: { soldCount: s._sum.quantity ?? 0 } });
  }

  // Verified-purchase reviews on delivered orders.
  const delivered = await prisma.orderItem.findMany({
    where: { order: { status: "DELIVERED", userId: { not: null } } },
    include: { order: true },
  });
  const bodies = [
    ["Beautiful quality", "Exactly as pictured and the finish is lovely. Would buy again."],
    ["Worth every taka", "Well made and arrived quickly. The packaging was plastic-free too."],
    ["Lovely gift", "Bought this as a gift and it was a hit. Feels premium."],
    ["Great everyday piece", "I use it daily. Solid build and a really pleasing design."],
    ["Good but runs small", "Quality is great, just slightly smaller than I expected."],
  ];
  for (const item of delivered) {
    if (!item.productId || rand() < 0.35) continue;
    const exists = await prisma.review.findUnique({
      where: { productId_userId: { productId: item.productId, userId: item.order.userId! } },
    });
    if (exists) continue;
    const [title, body] = pick(bodies);
    const rating = title.includes("small") ? 3 : rand() < 0.7 ? 5 : 4;
    await prisma.review.create({
      data: {
        productId: item.productId,
        userId: item.order.userId!,
        orderItemId: item.id,
        rating,
        title,
        body,
        status: rand() < 0.85 ? "APPROVED" : "PENDING",
        isVerifiedPurchase: true,
        createdAt: new Date(item.order.placedAt.getTime() + 5 * 86_400_000),
      },
    });
  }
  const products = await prisma.product.findMany({ select: { id: true } });
  for (const p of products) {
    const agg = await prisma.review.aggregate({ where: { productId: p.id, status: "APPROVED" }, _avg: { rating: true }, _count: true });
    await prisma.product.update({
      where: { id: p.id },
      data: { ratingAvg: (agg._avg.rating ?? 0).toFixed(2), reviewCount: agg._count },
    });
  }

  await prisma.newsletterSubscriber.createMany({
    data: ["ayesha@example.com", "nusrat@example.com", "reader@example.com"].map((email) => ({ email, source: "seed" })),
    skipDuplicates: true,
  });
  await prisma.contactMessage.create({
    data: {
      name: "Shirin Akter",
      email: "shirin@example.com",
      subject: "Bulk order for corporate gifts",
      message: "Hello! We would like 40 leather wallets and belts as staff gifts in December. Do you offer corporate pricing?",
    },
  });
  await prisma.notification.create({
    data: { audience: "ADMIN", type: "system", title: "Welcome to your Ezyza dashboard", body: "Demo data has been loaded.", link: "/admin" },
  });
}

/** Demo visitor traffic for the Traffic & sources dashboard (demo data only — never seeded in production). */
async function seedDemoTraffic() {
  if (await prisma.analyticsSession.count()) return;
  const products = await prisma.product.findMany({ select: { id: true, slug: true, effectivePrice: true } });
  if (!products.length) return;
  type Profile = {
    weight: number;
    source: string;
    channel: string;
    campaign?: string;
    ads?: string[];
    medium?: string;
    referrer?: string;
    clickIdType?: string;
    conv: number; // purchase probability
    atc: number; // add-to-cart probability
    mobile: number;
  };
  const profiles: Profile[] = [
    { weight: 22, source: "facebook", channel: "paid_social", campaign: "eid_sale_2026", ads: ["carousel_bags", "video_sunglasses", "single_image_shirts"], medium: "paid_social", referrer: "m.facebook.com", clickIdType: "fbclid", conv: 0.035, atc: 0.14, mobile: 0.92 },
    { weight: 12, source: "facebook", channel: "paid_social", campaign: "winter_footwear", ads: ["boots_reel", "sneakers_carousel"], medium: "paid_social", referrer: "m.facebook.com", clickIdType: "fbclid", conv: 0.022, atc: 0.11, mobile: 0.9 },
    { weight: 8, source: "instagram", channel: "paid_social", campaign: "eid_sale_2026", ads: ["story_handbags", "reel_new_drop"], medium: "paid_social", referrer: "l.instagram.com", clickIdType: "fbclid", conv: 0.028, atc: 0.13, mobile: 0.97 },
    { weight: 10, source: "facebook", channel: "organic_social", referrer: "m.facebook.com", conv: 0.012, atc: 0.07, mobile: 0.9 },
    { weight: 9, source: "instagram", channel: "organic_social", referrer: "l.instagram.com", conv: 0.015, atc: 0.08, mobile: 0.96 },
    { weight: 13, source: "google", channel: "organic_search", referrer: "www.google.com", conv: 0.03, atc: 0.12, mobile: 0.7 },
    { weight: 4, source: "chatgpt", channel: "ai", referrer: "chatgpt.com", conv: 0.045, atc: 0.16, mobile: 0.45 },
    { weight: 2, source: "perplexity", channel: "ai", referrer: "www.perplexity.ai", conv: 0.03, atc: 0.12, mobile: 0.4 },
    { weight: 5, source: "whatsapp", channel: "organic_social", referrer: "web.whatsapp.com", conv: 0.04, atc: 0.15, mobile: 0.85 },
    { weight: 13, source: "direct", channel: "direct", conv: 0.038, atc: 0.13, mobile: 0.6 },
    { weight: 2, source: "dhakafashionblog.com", channel: "referral", referrer: "dhakafashionblog.com", conv: 0.02, atc: 0.1, mobile: 0.55 },
  ];
  const totalWeight = profiles.reduce((s, p) => s + p.weight, 0);
  const pickProfile = () => {
    let r = rand() * totalWeight;
    for (const p of profiles) if ((r -= p.weight) <= 0) return p;
    return profiles[0];
  };
  const cities: [string, string][] = [["Dhaka", "C"], ["Dhaka", "C"], ["Dhaka", "C"], ["Chattogram", "B"], ["Sylhet", "G"], ["Rajshahi", "E"], ["Khulna", "D"], ["Gazipur", "C"], ["Narayanganj", "C"], ["Cumilla", "B"]];
  const landings = ["/", "/", "/categories/women", "/categories/men", "/products?type=sunglasses", "/products?type=bags", "/collections/summer-essentials"];

  for (let day = 59; day >= 0; day--) {
    const trend = 1 + (59 - day) / 45; // traffic grows over time
    const count = Math.round((25 + rand() * 20) * trend);
    for (let k = 0; k < count; k++) {
      const p = pickProfile();
      const startedAt = new Date(Date.now() - day * 86_400_000 - Math.floor(rand() * 86_400_000));
      const pages = rand() < 0.42 ? 1 : 2 + Math.floor(rand() * 7);
      const mobile = rand() < p.mobile;
      const [city, region] = pick(cities);
      const ad = p.ads ? pick(p.ads) : null;
      const landing = p.campaign ? pick(["/", "/categories/women", "/products?type=bags", "/products?type=sunglasses"]) : pick(landings);
      const events: { type: string; path?: string; productId?: string; value?: string; createdAt: Date }[] = [];
      const t = (i: number) => new Date(startedAt.getTime() + i * 45_000);
      events.push({ type: "page_view", path: landing.split("?")[0], createdAt: t(0) });
      for (let i = 1; i < pages; i++) {
        const prod = pick(products);
        events.push({ type: "page_view", path: rand() < 0.65 ? `/products/${prod.slug}` : pick(["/categories/men", "/categories/women", "/products", "/cart"]), createdAt: t(i) });
      }
      if (pages > 1 && rand() < p.atc * 2.2) {
        const prod = pick(products);
        events.push({ type: "add_to_cart", productId: prod.id, value: prod.effectivePrice.toFixed(2), createdAt: t(pages) });
        if (rand() < (p.conv / p.atc) * 1.1) {
          events.push({ type: "page_view", path: "/checkout", createdAt: t(pages + 1) });
          const value = Number(prod.effectivePrice) * (1 + Math.floor(rand() * 2)) + 70;
          events.push({ type: "purchase", value: value.toFixed(2), createdAt: t(pages + 3) });
        } else if (rand() < 0.35) {
          events.push({ type: "page_view", path: "/checkout", createdAt: t(pages + 1) });
        }
      }
      const last = events[events.length - 1].createdAt;
      await prisma.analyticsSession.create({
        data: {
          visitorId: `demo-${Math.floor(rand() * 2600)}`,
          startedAt,
          lastSeenAt: last,
          landingPath: landing.split("?")[0],
          referrerHost: p.referrer ?? null,
          source: p.source,
          channel: p.channel,
          campaign: p.campaign ?? null,
          utmSource: p.campaign ? p.source : null,
          utmMedium: p.medium ?? null,
          utmContent: ad,
          clickIdType: p.clickIdType ?? null,
          country: "BD",
          region,
          city,
          device: mobile ? (rand() < 0.06 ? "tablet" : "mobile") : "desktop",
          browser: p.source === "facebook" && mobile ? "Facebook app" : p.source === "instagram" && mobile ? "Instagram app" : mobile ? pick(["Chrome", "Chrome", "Samsung Internet", "Safari"]) : pick(["Chrome", "Chrome", "Edge", "Firefox", "Safari"]),
          os: mobile ? pick(["Android", "Android", "Android", "iOS"]) : pick(["Windows", "Windows", "macOS"]),
          pageViews: events.filter((e) => e.type === "page_view").length,
          events: { create: events.map((e) => ({ type: e.type, path: e.path ?? null, productId: e.productId ?? null, value: e.value ?? null, createdAt: e.createdAt })) },
        },
      });
    }
  }
}

async function main() {
  console.log("→ Seeding roles & permissions");
  await seedRbac(prisma);
  console.log("→ Seeding settings");
  await seedSettings();

  let adminId: string | null = null;
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
    if (existing?.isStaff) {
      console.log(`→ Super Admin ${adminEmail} already exists (use \`npm run admin:create\` to reset)`);
      adminId = existing.id;
    } else {
      const admin = await upsertSuperAdmin(prisma, {
        email: adminEmail,
        password: adminPassword,
        name: process.env.SEED_ADMIN_NAME || "Store Owner",
      });
      adminId = admin.id;
      console.log(`→ Super Admin created: ${admin.email}`);
    }
  } else {
    console.warn("! SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping Super Admin. Run `npm run admin:create` later.");
  }

  if (process.env.SEED_DEMO === "false") {
    console.log("→ SEED_DEMO=false: skipping demo content");
  } else {
    console.log("→ Seeding shipping zones");
    await seedShipping();
    console.log("→ Seeding catalog");
    await seedCatalog();
    await seedCollections();
    console.log("→ Seeding content, coupons & blog");
    await seedContent(adminId);
    if (process.env.SEED_DEMO_CUSTOMERS === "false") {
      console.log("→ SEED_DEMO_CUSTOMERS=false: skipping demo customers, orders & reviews");
    } else {
      console.log("→ Seeding demo customers, orders & reviews");
      await seedCustomersAndOrders();
      console.log("→ Seeding demo visitor traffic");
      await seedDemoTraffic();
    }
  }
  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
