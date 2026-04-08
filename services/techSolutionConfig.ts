import { TechSolutionCategory, TechSolutionConfig, TechSolutionDefinition } from '../types.js';

export const TECH_SOLUTION_CATEGORY_LABELS: Record<TechSolutionCategory, string> = {
  ecommercePlatforms: 'E-handelsplattformar',
  checkoutSolutions: 'Checkout-losningar',
  paymentProviders: 'Betalproviders',
  taSystems: 'TA-system',
  logisticsSignals: 'Logistiksignaler'
};

export const DEFAULT_TECH_SOLUTION_CONFIG: TechSolutionConfig = {
  solutions: [
    { id: 'platform-shopify', category: 'ecommercePlatforms', label: 'Shopify', keywords: ['shopify'], enabled: true },
    { id: 'platform-woocommerce', category: 'ecommercePlatforms', label: 'WooCommerce', keywords: ['woocommerce'], enabled: true },
    { id: 'platform-magento', category: 'ecommercePlatforms', label: 'Magento', keywords: ['magento', 'adobe commerce'], enabled: true },
    { id: 'platform-centra', category: 'ecommercePlatforms', label: 'Centra', keywords: ['centra'], enabled: true },
    { id: 'platform-norce', category: 'ecommercePlatforms', label: 'Norce', keywords: ['norce'], enabled: true },
    { id: 'platform-prestashop', category: 'ecommercePlatforms', label: 'PrestaShop', keywords: ['prestashop'], enabled: true },
    { id: 'platform-viskan', category: 'ecommercePlatforms', label: 'Viskan', keywords: ['viskan'], enabled: true },
    { id: 'platform-askas', category: 'ecommercePlatforms', label: 'Askas', keywords: ['askas', 'askås', 'askas.se', 'askas e-handel', 'askas ecommerce'], enabled: true },
    { id: 'platform-litium', category: 'ecommercePlatforms', label: 'Litium', keywords: ['litium'], enabled: true },
    { id: 'platform-jetshop', category: 'ecommercePlatforms', label: 'Jetshop', keywords: ['jetshop'], enabled: true },
    { id: 'platform-wikinggruppen', category: 'ecommercePlatforms', label: 'Wikinggruppen', keywords: ['wikinggruppen'], enabled: true },

    { id: 'checkout-klarna', category: 'checkoutSolutions', label: 'Klarna Checkout', keywords: ['klarna checkout', 'kco'], enabled: true },
    { id: 'checkout-adyen', category: 'checkoutSolutions', label: 'Adyen Checkout', keywords: ['adyen checkout'], enabled: true },
    { id: 'checkout-stripe', category: 'checkoutSolutions', label: 'Stripe Checkout', keywords: ['stripe checkout'], enabled: true },
    { id: 'checkout-qliro', category: 'checkoutSolutions', label: 'Qliro Checkout', keywords: ['qliro checkout'], enabled: true },
    { id: 'checkout-walley', category: 'checkoutSolutions', label: 'Walley Checkout', keywords: ['walley checkout'], enabled: true },
    { id: 'checkout-svea', category: 'checkoutSolutions', label: 'Svea Checkout', keywords: ['svea checkout'], enabled: true },
    { id: 'checkout-nets', category: 'checkoutSolutions', label: 'Nets Easy', keywords: ['nets easy'], enabled: true },
    { id: 'checkout-avarda', category: 'checkoutSolutions', label: 'Avarda Checkout', keywords: ['avarda checkout'], enabled: true },
    { id: 'checkout-checkoutcom', category: 'checkoutSolutions', label: 'Checkout.com', keywords: ['checkout.com'], enabled: true },

    { id: 'payment-klarna', category: 'paymentProviders', label: 'Klarna', keywords: ['klarna checkout', 'klarna payments', 'klarna'], enabled: true },
    { id: 'payment-adyen', category: 'paymentProviders', label: 'Adyen', keywords: ['adyen checkout', 'adyen'], enabled: true },
    { id: 'payment-stripe', category: 'paymentProviders', label: 'Stripe', keywords: ['stripe checkout', 'stripe'], enabled: true },
    { id: 'payment-qliro', category: 'paymentProviders', label: 'Qliro', keywords: ['qliro checkout', 'qliro'], enabled: true },
    { id: 'payment-walley', category: 'paymentProviders', label: 'Walley', keywords: ['walley checkout', 'walley'], enabled: true },
    { id: 'payment-svea', category: 'paymentProviders', label: 'Svea', keywords: ['svea checkout', 'svea'], enabled: true },
    { id: 'payment-nets', category: 'paymentProviders', label: 'Nets', keywords: ['nets easy', 'nets'], enabled: true },
    { id: 'payment-checkoutcom', category: 'paymentProviders', label: 'Checkout.com', keywords: ['checkout.com'], enabled: true },
    { id: 'payment-payex', category: 'paymentProviders', label: 'PayEx', keywords: ['payex'], enabled: true },
    { id: 'payment-avarda', category: 'paymentProviders', label: 'Avarda', keywords: ['avarda'], enabled: true },
    { id: 'payment-resurs', category: 'paymentProviders', label: 'Resurs', keywords: ['resurs'], enabled: true },
    { id: 'payment-collector', category: 'paymentProviders', label: 'Collector', keywords: ['collector'], enabled: true },

    { id: 'ta-nshift', category: 'taSystems', label: 'nShift', keywords: ['nshift', 'consignor'], enabled: true },
    { id: 'ta-unifaun', category: 'taSystems', label: 'Unifaun', keywords: ['unifaun', 'pacsoft'], enabled: true },
    { id: 'ta-centiro', category: 'taSystems', label: 'Centiro', keywords: ['centiro'], enabled: true },
    { id: 'ta-ingrid', category: 'taSystems', label: 'Ingrid', keywords: ['ingrid'], enabled: true },
    { id: 'ta-logtrade', category: 'taSystems', label: 'Logtrade', keywords: ['logtrade'], enabled: true },
    { id: 'ta-shipmondo', category: 'taSystems', label: 'Shipmondo', keywords: ['shipmondo'], enabled: true },
    { id: 'ta-nyce', category: 'taSystems', label: 'Nyce', keywords: ['nyce'], enabled: true },

    { id: 'logistics-instabox', category: 'logisticsSignals', label: 'Instabox', keywords: ['instabox'], enabled: true },
    { id: 'logistics-budbee', category: 'logisticsSignals', label: 'Budbee', keywords: ['budbee'], enabled: true },
    { id: 'logistics-bring', category: 'logisticsSignals', label: 'Bring', keywords: ['bring'], enabled: true },
    { id: 'logistics-postnord', category: 'logisticsSignals', label: 'PostNord', keywords: ['postnord'], enabled: true },
    { id: 'logistics-dhl', category: 'logisticsSignals', label: 'DHL', keywords: ['dhl'], enabled: true },
    { id: 'logistics-dbschenker', category: 'logisticsSignals', label: 'DB Schenker', keywords: ['db schenker'], enabled: true },
    { id: 'logistics-airmee', category: 'logisticsSignals', label: 'Airmee', keywords: ['airmee'], enabled: true }
  ]
};

function normalizeSolution(solution: Partial<TechSolutionDefinition> | null | undefined, index: number): TechSolutionDefinition | null {
  const label = String(solution?.label || '').trim();
  const category = solution?.category as TechSolutionCategory | undefined;
  if (!label || !category || !(category in TECH_SOLUTION_CATEGORY_LABELS)) return null;

  const keywords = Array.isArray(solution?.keywords)
    ? solution!.keywords.reduce<string[]>((acc, keyword) => {
        const normalizedKeyword = String(keyword || '').trim().replace(/\s+/g, ' ');
        if (!normalizedKeyword) return acc;

        const exists = acc.some((entry) => entry.toLowerCase() === normalizedKeyword.toLowerCase());
        if (!exists) acc.push(normalizedKeyword);
        return acc;
      }, [])
    : [];

  if (!keywords.length) return null;

  return {
    id: String(solution?.id || `${category}-${label}-${index}`),
    category,
    label,
    keywords,
    enabled: solution?.enabled !== false
  };
}

export function normalizeTechSolutionConfig(input?: unknown): TechSolutionConfig {
  const rawSolutions = (input && typeof input === 'object' && Array.isArray((input as any).solutions))
    ? (input as any).solutions
    : undefined;

  const solutions = (rawSolutions || DEFAULT_TECH_SOLUTION_CONFIG.solutions)
    .map((solution: Partial<TechSolutionDefinition>, index: number) => normalizeSolution(solution, index))
    .filter(Boolean) as TechSolutionDefinition[];

  return {
    solutions: solutions.length ? solutions : DEFAULT_TECH_SOLUTION_CONFIG.solutions
  };
}

export function getTechSolutionsByCategory(config: TechSolutionConfig, category: TechSolutionCategory): TechSolutionDefinition[] {
  return normalizeTechSolutionConfig(config).solutions.filter((solution) => solution.enabled && solution.category === category);
}

export function createTechSolution(label = '', category: TechSolutionCategory = 'ecommercePlatforms', keywords: string[] = []): TechSolutionDefinition {
  return {
    id: crypto.randomUUID(),
    category,
    label,
    keywords,
    enabled: true
  };
}