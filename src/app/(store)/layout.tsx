import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/services/settings";
import { getCategoryTree } from "@/services/catalog";
import { getCartCount } from "@/services/cart";
import { StoreProvider } from "@/components/shared/store-context";
import { CartUIProvider } from "@/components/cart/cart-ui-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MaintenanceScreen } from "@/components/layout/maintenance-screen";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, categories, cartCount] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    getCategoryTree(),
    getCartCount(),
  ]);

  if (settings.maintenance.enabled && !user?.isStaff) {
    return <MaintenanceScreen siteName={settings.general.siteName} message={settings.maintenance.message} />;
  }

  return (
    <StoreProvider
      value={{
        siteName: settings.general.siteName,
        currency: settings.general.currency,
        user: user ? { id: user.id, name: user.name, email: user.email, isStaff: user.isStaff } : null,
      }}
    >
      <CartUIProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        {settings.announcement.enabled && settings.announcement.text && (
          <AnnouncementBar text={settings.announcement.text} link={settings.announcement.link} />
        )}
        <SiteHeader settings={settings} categories={categories} cartCount={cartCount} />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter settings={settings} categories={categories} />
        <CartDrawer />
      </CartUIProvider>
    </StoreProvider>
  );
}
