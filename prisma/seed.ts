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
        create: { slug: child.slug, name: child.name, parentId: parent.id, sortOrder: j },
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
    const sku = `OAK-${p.category.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
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
        seoTitle: `${p.name} | Oakline`,
        seoDescription: p.short,
        publishedAt: daysAgo(Math.floor(rand() * 150)),
        createdAt: daysAgo(Math.floor(rand() * 150) + 5),
        images: {
          create: p.images.map((key, i) => ({ url: img(IMG[key]), alt: i === 0 ? p.name : `${p.name} — detail`, sortOrder: i })),
        },
        attributes: {
          create: Object.entries(p.attributes).map(([name, value]) => ({ attributeId: attributeIds.get(name)!, value })),
        },
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
      name: "The Slow Morning",
      slug: "the-slow-morning",
      description: "Mugs, candles and notebooks for unhurried starts.",
      image: IMG.coffeeHands,
      products: ["morning-ceramic-mug", "speckled-stoneware-cups-set-of-4", "ember-soy-candle", "linen-bound-notebook", "fountain-pen-writing-set"],
    },
    {
      name: "Weekend Escape",
      slug: "weekend-escape",
      description: "Carry-alls and sun-ready accessories for getting away.",
      image: IMG.bagWicker,
      products: ["wicker-weekend-basket", "round-gold-sunglasses", "washed-cotton-cap", "market-tote", "everyday-commuter-backpack"],
    },
    {
      name: "Warm Minimal Living",
      slug: "warm-minimal-living",
      description: "Lighting, textiles and objects in earthy, quiet tones.",
      image: IMG.livingTan,
      products: ["arc-steel-floor-lamp", "alder-stoneware-vase", "linen-lumbar-cushion", "teak-drum-side-table", "rattan-sun-mirror"],
    },
    {
      name: "Gifts Under ৳3,000",
      slug: "gifts-under-3000",
      description: "Thoughtful presents that don't overthink the budget.",
      image: IMG.giftKraft,
      products: ["kraft-surprise-box", "bifold-leather-wallet", "ember-soy-candle", "botanical-face-serum", "slim-card-wallet"],
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
          title: "Made for slow living",
          subtitle: "Natural materials, honest craft and quiet design for every room of your home.",
          eyebrow: "New season",
          imageUrl: img(IMG.livingBoho, 2000),
          ctaLabel: "Shop new arrivals",
          ctaHref: "/products?sort=newest",
          placement: "HERO",
          sortOrder: 0,
        },
        {
          title: "Light, reconsidered",
          subtitle: "Sculptural lamps and pendants from Nord & Ash.",
          eyebrow: "Lighting edit",
          imageUrl: img(IMG.loft, 2000),
          ctaLabel: "Explore lighting",
          ctaHref: "/categories/lighting",
          placement: "HERO",
          sortOrder: 1,
        },
        {
          title: "Up to 20% off bags & leather",
          subtitle: "Full-grain pieces that only get better with time. Limited stock.",
          eyebrow: "Seasonal sale",
          imageUrl: img(IMG.sofaGreen, 1800),
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
      { key: "categories", type: "categories", title: "Shop by category", subtitle: "Everything for a considered home and everyday life.", config: { limit: 6 } },
      { key: "trending", type: "products", title: "Trending now", subtitle: "What our community is loving this month.", config: { source: "trending", limit: 8 } },
      { key: "promo", type: "promo", title: "Promotional banner", config: {} },
      { key: "best_sellers", type: "products", title: "Best sellers", subtitle: "Tried, tested and reordered.", config: { source: "best_sellers", limit: 8 } },
      { key: "collections", type: "collections", title: "Featured collections", subtitle: "Edits curated by our studio.", config: { limit: 4 } },
      { key: "new_arrivals", type: "products", title: "New arrivals", subtitle: "Fresh from the workshop.", config: { source: "new_arrivals", limit: 8 } },
      {
        key: "story",
        type: "story",
        title: "Designed in Dhaka, made to last",
        config: {
          eyebrow: "Our story",
          body: "Oakline began in a small studio in Gulshan with a simple belief: the objects we live with every day should be beautiful, useful and built to last. We work directly with makers across Bangladesh and beyond — potters, weavers and leatherworkers — paying fairly and choosing natural materials wherever we can.",
          imageUrl: img(IMG.interiorDresser, 1400),
          ctaLabel: "Read our story",
          ctaHref: "/about",
        },
      },
      { key: "testimonials", type: "testimonials", title: "Kind words", subtitle: "From customers across Bangladesh.", config: {} },
      { key: "newsletter", type: "newsletter", title: "Newsletter", config: {} },
      {
        key: "instagram",
        type: "instagram",
        title: "@oakline.home",
        subtitle: "Tag us to be featured.",
        config: {
          handle: "oakline.home",
          url: "https://instagram.com/",
          images: [IMG.livingTan, IMG.interiorDresser, IMG.sofaGreen, IMG.livingClock, IMG.ceramicCups, IMG.succulent].map((i) => img(i, 600)),
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
        { name: "Nusrat J.", location: "Dhaka", quote: "The Alder vase is even more beautiful in person. Packaging was thoughtful and delivery took a day.", rating: 5, sortOrder: 0 },
        { name: "Tanvir A.", location: "Chattogram", quote: "My leather backpack has been with me every day for six months and only looks better. Brilliant quality.", rating: 5, sortOrder: 1 },
        { name: "Farhana R.", location: "Sylhet", quote: "Lovely candles and the gift wrapping made it so easy. Cash on delivery was smooth too.", rating: 4, sortOrder: 2 },
      ],
    });
  }

  if (!(await prisma.blogPost.count())) {
    const living = await prisma.blogCategory.create({ data: { name: "Living", slug: "living" } });
    const guides = await prisma.blogCategory.create({ data: { name: "Guides", slug: "guides" } });
    const posts = [
      {
        title: "Five ways to make a small room feel calm",
        slug: "five-ways-to-make-a-small-room-feel-calm",
        excerpt: "Light, texture and restraint — simple changes that make compact spaces feel generous.",
        categoryId: living.id,
        cover: IMG.bedroom,
        tags: ["interiors", "small spaces"],
        content:
          "<p>Small rooms reward restraint. Before buying anything new, try editing what is already there: clear surfaces, group objects in odd numbers and let the walls breathe.</p><h2>1. Layer your lighting</h2><p>Replace a single ceiling light with three sources at different heights — a floor lamp, a table lamp and a candle. Warm, low light makes edges soften and rooms feel bigger.</p><h2>2. Choose a quiet palette</h2><p>Oat, chalk and clay tones reflect light and connect furniture visually. Add contrast with one darker element, like a charcoal cushion.</p><h2>3. Mirrors, placed with intent</h2><p>A round mirror opposite a window doubles the daylight. Rattan frames add texture without visual weight.</p><h2>4. Texture over pattern</h2><p>Linen, stoneware and wood bring interest without busyness.</p><h2>5. Leave one corner empty</h2><p>Negative space is a design choice. It gives the eye somewhere to rest.</p>",
      },
      {
        title: "How to care for full-grain leather",
        slug: "how-to-care-for-full-grain-leather",
        excerpt: "A few minutes every season keeps your bag or wallet supple for decades.",
        categoryId: guides.id,
        cover: IMG.backpackLeather,
        tags: ["leather", "care"],
        content:
          "<p>Full-grain leather is the strongest, most characterful part of the hide. Treated well, it develops a patina that tells the story of everywhere you have been.</p><h2>Clean gently</h2><p>Wipe with a soft, dry cloth after use. For marks, use a barely damp cloth and let it air dry away from direct heat.</p><h2>Condition each season</h2><p>Apply a small amount of natural leather balm with circular motions, then buff. This keeps fibres supple and resists cracking in Dhaka's dry winter.</p><h2>Store it stuffed</h2><p>Fill bags with tissue paper to keep their shape and keep them in a breathable dust bag — never plastic.</p>",
      },
      {
        title: "The ritual of a slow morning",
        slug: "the-ritual-of-a-slow-morning",
        excerpt: "Why the first twenty minutes of the day deserve better than a phone screen.",
        categoryId: living.id,
        cover: IMG.coffeeHands,
        tags: ["ritual", "coffee"],
        content:
          "<p>We asked our studio team how they start the day. The answers had something in common: a warm cup, a little light and no screens for the first twenty minutes.</p><blockquote>A good mug makes coffee taste better. I don't make the rules.</blockquote><p>Try it this week: light a candle, write three lines in a notebook and drink your tea before you check your messages. Small rituals, repeated, change the shape of a day.</p>",
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
    const homeDecor = await prisma.category.findUnique({ where: { slug: "home-decor" } });
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
        code: "HOME15",
        description: "15% off Home Decor",
        type: "PERCENTAGE",
        value: 15,
        categories: homeDecor ? { connect: { id: homeDecor.id } } : undefined,
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
    const orderNumber = `OAK-${ymd}-${String(1000 + n)}`;
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
      message: "Hello! We'd like 40 Celebration Gift Boxes for our office in December. Do you offer corporate pricing?",
    },
  });
  await prisma.notification.create({
    data: { audience: "ADMIN", type: "system", title: "Welcome to your Oakline dashboard", body: "Demo data has been loaded.", link: "/admin" },
  });
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
    console.log("→ Seeding demo customers, orders & reviews");
    await seedCustomersAndOrders();
  }
  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
