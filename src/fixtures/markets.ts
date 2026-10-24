// Hand-checked details for the first 18 markets: main delivery city, local tax names and
// shipping. scripts/data/build-countries.ts applies them over the open datasets.
// Tax rates are headline import VAT/GST and ignore product exemptions.
import type { Region } from "@/lib/types";

type CuratedMarket = {
  code: string;
  name: string;
  flag: string;
  region: Region;
  city: string;
  timeZone: string;
  currency: string;
  /** Snapshot rate, superseded by the generated fx-rates.json. */
  rate: number;
  vat: number;
  vatLabel: string;
  shipping: number;
  freeShippingOver: number;
  extraDays: number;
  /** Design-phase payment methods; payment is now stablecoins everywhere. */
  payments: string[];
};

export const markets: CuratedMarket[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Africa", city: "Lagos", timeZone: "Africa/Lagos", currency: "NGN", rate: 1324.6, vat: 0.075, vatLabel: "VAT", shipping: 7, freeShippingOver: 60, extraDays: 3, payments: ["Card", "Opay", "Bank transfer", "Pay on delivery"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", region: "Africa", city: "Accra", timeZone: "Africa/Accra", currency: "GHS", rate: 11.66, vat: 0.15, vatLabel: "VAT", shipping: 7, freeShippingOver: 60, extraDays: 3, payments: ["MTN MoMo", "Telecel Cash", "Card"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", region: "Africa", city: "Nairobi", timeZone: "Africa/Nairobi", currency: "KES", rate: 129.87, vat: 0.16, vatLabel: "VAT", shipping: 6, freeShippingOver: 55, extraDays: 2, payments: ["M-Pesa", "Airtel Money", "Card"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", region: "Africa", city: "Johannesburg", timeZone: "Africa/Johannesburg", currency: "ZAR", rate: 16.5, vat: 0.15, vatLabel: "VAT", shipping: 6, freeShippingOver: 55, extraDays: 2, payments: ["Card", "Instant EFT", "Pay in 3"] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", region: "Africa", city: "Cairo", timeZone: "Africa/Cairo", currency: "EGP", rate: 55.22, vat: 0.14, vatLabel: "VAT", shipping: 6, freeShippingOver: 55, extraDays: 2, payments: ["Card", "Fawry", "Vodafone Cash"] },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", region: "Africa", city: "Abidjan", timeZone: "Africa/Abidjan", currency: "XOF", rate: 584.82, vat: 0.18, vatLabel: "VAT", shipping: 8, freeShippingOver: 65, extraDays: 4, payments: ["Orange Money", "MTN MoMo", "Wave"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "Europe", city: "London", timeZone: "Europe/London", currency: "GBP", rate: 0.7467, vat: 0.2, vatLabel: "VAT", shipping: 5, freeShippingOver: 45, extraDays: 0, payments: ["Card", "Apple Pay", "Pay in 3"] },
  { code: "DE", name: "Germany", flag: "🇩🇪", region: "Europe", city: "Berlin", timeZone: "Europe/Berlin", currency: "EUR", rate: 0.8915, vat: 0.19, vatLabel: "VAT", shipping: 5, freeShippingOver: 45, extraDays: 0, payments: ["Card", "PayPal", "Klarna"] },
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe", city: "Paris", timeZone: "Europe/Paris", currency: "EUR", rate: 0.8915, vat: 0.2, vatLabel: "VAT", shipping: 5, freeShippingOver: 45, extraDays: 0, payments: ["Card", "PayPal", "Pay in 4"] },
  { code: "US", name: "United States", flag: "🇺🇸", region: "Americas", city: "Los Angeles", timeZone: "America/Los_Angeles", currency: "USD", rate: 1, vat: 0, vatLabel: "Sales tax", shipping: 6, freeShippingOver: 49, extraDays: 1, payments: ["Card", "Apple Pay", "Pay in 4"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "Americas", city: "Toronto", timeZone: "America/Toronto", currency: "CAD", rate: 1.4014, vat: 0.13, vatLabel: "HST", shipping: 6, freeShippingOver: 49, extraDays: 1, payments: ["Card", "PayPal", "Pay in 4"] },
  { code: "BR", name: "Brazil", flag: "🇧🇷", region: "Americas", city: "São Paulo", timeZone: "America/Sao_Paulo", currency: "BRL", rate: 5.043, vat: 0.17, vatLabel: "ICMS", shipping: 7, freeShippingOver: 50, extraDays: 4, payments: ["Pix", "Card", "Boleto"] },
  { code: "MX", name: "Mexico", flag: "🇲🇽", region: "Americas", city: "Mexico City", timeZone: "America/Mexico_City", currency: "MXN", rate: 18.73, vat: 0.16, vatLabel: "IVA", shipping: 6, freeShippingOver: 49, extraDays: 2, payments: ["Card", "OXXO", "Mercado Pago"] },
  { code: "IN", name: "India", flag: "🇮🇳", region: "Asia-Pacific", city: "Mumbai", timeZone: "Asia/Kolkata", currency: "INR", rate: 94.9, vat: 0.18, vatLabel: "GST", shipping: 5, freeShippingOver: 40, extraDays: 1, payments: ["UPI", "Card", "Pay later"] },
  { code: "PH", name: "Philippines", flag: "🇵🇭", region: "Asia-Pacific", city: "Manila", timeZone: "Asia/Manila", currency: "PHP", rate: 63.53, vat: 0.12, vatLabel: "VAT", shipping: 4, freeShippingOver: 35, extraDays: 0, payments: ["GCash", "Maya", "Card"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific", city: "Jakarta", timeZone: "Asia/Jakarta", currency: "IDR", rate: 18082, vat: 0.11, vatLabel: "VAT", shipping: 4, freeShippingOver: 35, extraDays: 0, payments: ["GoPay", "OVO", "DANA", "Card"] },
  { code: "AU", name: "Australia", flag: "🇦🇺", region: "Asia-Pacific", city: "Sydney", timeZone: "Australia/Sydney", currency: "AUD", rate: 1.4253, vat: 0.1, vatLabel: "GST", shipping: 6, freeShippingOver: 49, extraDays: 1, payments: ["Card", "Afterpay", "PayPal"] },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", region: "Middle East", city: "Dubai", timeZone: "Asia/Dubai", currency: "AED", rate: 3.6725, vat: 0.05, vatLabel: "VAT", shipping: 5, freeShippingOver: 45, extraDays: 0, payments: ["Card", "Apple Pay", "Tabby"] },
];

export const defaultMarket = "US";

