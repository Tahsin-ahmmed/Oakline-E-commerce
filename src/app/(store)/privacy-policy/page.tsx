import Link from "next/link";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/content/policy-layout";
import { getSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal information we collect, how we use it and the choices you have.",
  alternates: { canonical: "/privacy-policy" },
};

export default async function PrivacyPolicyPage() {
  const { general } = await getSettings();
  const name = general.siteName;
  return (
    <PolicyLayout
      title="Privacy policy"
      description={`${name} respects your privacy. This policy explains what we collect, why, and how we keep it safe.`}
      updated={new Date("2026-11-01")}
      contactEmail={general.contactEmail}
      sections={[
        {
          id: "collect",
          title: "Information we collect",
          body: (
            <>
              <p>We only collect what we need to run the shop and look after you:</p>
              <ul>
                <li><strong>Account details</strong> — your name, email, phone number and a securely hashed password.</li>
                <li><strong>Order details</strong> — delivery addresses, items purchased, order notes and payment status.</li>
                <li><strong>Payment information</strong> — card payments are handled entirely by Stripe. We never receive or store your full card number.</li>
                <li><strong>Communications</strong> — messages you send us and your newsletter preferences.</li>
                <li><strong>Technical data</strong> — browser and device type, approximate location, the page that referred you, and cookies used to keep you signed in, remember your bag and measure visits (see Cookies).</li>
              </ul>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <ul>
              <li>To process, deliver and support your orders, including sharing your name, phone and address with our courier partner.</li>
              <li>To send order confirmations, delivery updates and account emails such as password resets.</li>
              <li>To send our newsletter — only if you subscribed, and you can unsubscribe at any time.</li>
              <li>To prevent fraud, abuse and unauthorised access, for example by rate-limiting sign-in attempts.</li>
              <li>To understand what our customers love and improve our products and service.</li>
            </ul>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <>
              <p>
                We use a small number of essential, HTTP-only cookies: one to keep you signed in securely and one to remember your shopping bag if
                you are browsing as a guest. Your recently viewed products are stored only in your own browser.
              </p>
              <p>
                We also use two first-party analytics cookies to understand how visitors find us (for example, from a search engine, social media
                post or advertisement) and which pages they view. This tells us which marketing works. We record the referring website, campaign
                tags in the link, device type and an approximate location (city) — we do not store your IP address, and this data is never sold.
              </p>
              <p>
                If enabled, we use the Meta (Facebook) Pixel to measure the results of our Facebook and Instagram ads and to show relevant ads.
                Meta may set its own cookies for this purpose, under Meta&apos;s privacy policy. You can manage ad preferences in your Facebook or
                Instagram settings, and you can block or delete cookies in your browser at any time.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Who we share it with",
          body: (
            <>
              <p>We never sell your personal data. We share it only with service providers who help us operate, and only as much as they need:</p>
              <ul>
                <li>Courier partners (delivery details)</li>
                <li>Payment processors such as Stripe (payment details)</li>
                <li>Email delivery and cloud hosting providers</li>
              </ul>
              <p>We may also disclose information where required by Bangladeshi law or to protect our customers and business from fraud.</p>
            </>
          ),
        },
        {
          id: "security",
          title: "How we protect it",
          body: (
            <p>
              Passwords are stored using strong one-way hashing, connections are encrypted with HTTPS, and staff access to customer data is limited by
              role and logged. No system is perfectly secure, but we work hard to keep your information safe and will notify you promptly of any
              breach that affects you.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <p>
              We keep order records for as long as needed for accounting and tax purposes (typically six years). Account information is kept while your
              account is active. You can ask us to close your account and delete personal data we are not legally required to keep.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your choices and rights",
          body: (
            <p>
              You can view and update your details in <Link href="/account">My account</Link>, unsubscribe from marketing emails using the link in any
              newsletter, and contact us to request a copy of your data or its deletion. We&apos;ll respond within 30 days.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>We may update this policy from time to time. Significant changes will be announced on this page and, where appropriate, by email.</p>,
        },
      ]}
    />
  );
}
