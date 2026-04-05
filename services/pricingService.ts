import { CarrierPriceRule, CarrierProductMapping, CarrierSettings, LeadData, PricingProductSource, Segment } from '../types';

export interface PricingScenario {
  productName: string;
  annualPackages: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface CarrierScenarioMatch {
  carrier: CarrierSettings;
  matchedRule: CarrierPriceRule;
  effectivePrice: number;
}

export interface OfferRecommendation {
  scenario: PricingScenario;
  focusMatch?: CarrierScenarioMatch;
  competitorMatches: CarrierScenarioMatch[];
  allMatches: CarrierScenarioMatch[];
  targetPrice: number;
  priceDelta: number;
  positioning: string;
  recommendedPriceFloor: number;
  recommendedPriceCeiling: number;
}

export interface BudgetVolumeEstimateOptions {
  activeCarrier?: string;
  productName?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface PricingProductSelection {
  productName: string;
  source: PricingProductSource;
}

const DEFAULT_VOLUME_ONLY_PROFILE = {
  weightKg: 3,
  lengthCm: 35,
  widthCm: 25,
  heightCm: 12
};

export function buildScenarioRecommendation(settings: CarrierSettings[], scenario: PricingScenario): OfferRecommendation {
  const allMatches = findScenarioMatches(settings, scenario).sort((left, right) => left.effectivePrice - right.effectivePrice);
  const focusMatch = allMatches.find((entry) => entry.carrier.isFocusCarrier);
  const competitorMatches = allMatches.filter((entry) => !entry.carrier.isFocusCarrier);

  if (!focusMatch) {
    return {
      scenario,
      focusMatch: undefined,
      competitorMatches,
      allMatches,
      targetPrice: 0,
      priceDelta: 0,
      positioning: 'Ingen prisrad matchar fokuscarrier för detta scenario ännu.',
      recommendedPriceFloor: 0,
      recommendedPriceCeiling: 0
    };
  }

  if (!competitorMatches.length) {
    return {
      scenario,
      focusMatch,
      competitorMatches,
      allMatches,
      targetPrice: focusMatch.effectivePrice,
      priceDelta: 0,
      positioning: 'Inga konkurrentpriser matchar scenario. Utgå från fokuscarrierns nuvarande nivå.',
      recommendedPriceFloor: focusMatch.effectivePrice,
      recommendedPriceCeiling: focusMatch.effectivePrice
    };
  }

  const competitorPrices = competitorMatches.map((entry) => entry.effectivePrice);
  const cheapestCompetitor = Math.min(...competitorPrices);
  const highestCompetitor = Math.max(...competitorPrices);
  const competitorAverage = competitorPrices.reduce((sum, price) => sum + price, 0) / competitorPrices.length;
  const targetPrice = Number((((cheapestCompetitor + competitorAverage) / 2)).toFixed(2));
  const priceDelta = Number((targetPrice - focusMatch.effectivePrice).toFixed(2));

  let positioning = 'Ni ligger nära marknadens mittpunkt.';
  if (focusMatch.effectivePrice > competitorAverage * 1.03) {
    positioning = 'Fokuscarrier ligger över marknaden. En nedjustering ökar konkurrenskraften.';
  } else if (focusMatch.effectivePrice < cheapestCompetitor * 0.98) {
    positioning = 'Fokuscarrier ligger aggressivt lågt. Det finns utrymme att höja priset.';
  } else if (focusMatch.effectivePrice <= competitorAverage) {
    positioning = 'Fokuscarrier ligger konkurrenskraftigt mot konkurrenterna.';
  }

  return {
    scenario,
    focusMatch,
    competitorMatches,
    allMatches,
    targetPrice,
    priceDelta,
    positioning,
    recommendedPriceFloor: Number(cheapestCompetitor.toFixed(2)),
    recommendedPriceCeiling: Number(highestCompetitor.toFixed(2))
  };
}

export function createPriceRule(overrides?: Partial<CarrierPriceRule>): CarrierPriceRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productName: 'Parcel Connect',
    customerAnnualPackagesMin: 0,
    customerAnnualPackagesMax: 5000,
    weightMinKg: 0,
    weightMaxKg: 5,
    maxLengthCm: 60,
    maxWidthCm: 40,
    maxHeightCm: 40,
    priceSek: 49,
    notes: '',
    ...overrides
  };
}

export function createCarrierSettings(name: string, values: Partial<CarrierSettings> = {}): CarrierSettings {
  return {
    name,
    marketShare: 0,
    avgPrice: 0,
    dmt: 0,
    sulfur: 0,
    volumeOmbud: 0,
    volumeSkap: 0,
    volumeHem: 0,
    agentLocationCount: 0,
    lockerLocationCount: 0,
    homeDeliveryReachPeople: 0,
    networkCoverageSourceUrl: '',
    networkCoverageSourceLabel: '',
    networkCoverageCapturedAt: '',
    networkCoverageConfidence: 'missing',
    networkCoverageSnippet: '',
    isFocusCarrier: false,
    priceRules: [createPriceRule()],
    productMappings: [],
    ...values
  };
}

export function createCarrierProductMapping(overrides?: Partial<CarrierProductMapping>): CarrierProductMapping {
  return {
    id: `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    checkoutKeyword: '',
    deliveryMethodKeyword: '',
    mappedProductName: 'Parcel Connect',
    notes: '',
    ...overrides
  };
}

export function normalizeCarrierSettings(input: CarrierSettings[]): CarrierSettings[] {
  const base = Array.isArray(input) ? input : [];
  const normalized = base
    .filter((carrier) => carrier && carrier.name)
    .map((carrier, index) => ({
      ...createCarrierSettings(carrier.name, {
        ...carrier,
        isFocusCarrier: carrier.isFocusCarrier ?? index === 0,
        priceRules: Array.isArray(carrier.priceRules) && carrier.priceRules.length
          ? carrier.priceRules.map((rule) => createPriceRule(rule))
          : [createPriceRule({ productName: 'Parcel Connect', priceSek: carrier.avgPrice || 0 })],
        productMappings: Array.isArray(carrier.productMappings)
          ? carrier.productMappings.map((mapping) => createCarrierProductMapping(mapping))
          : []
      })
    }));

  if (!normalized.some((carrier) => carrier.isFocusCarrier) && normalized[0]) {
    normalized[0].isFocusCarrier = true;
  }

  return normalized;
}

export function calculateEffectivePrice(carrier: CarrierSettings, rule: CarrierPriceRule): number {
  const surchargeFactor = 1 + ((carrier.dmt || 0) + (carrier.sulfur || 0)) / 100;
  return Number((rule.priceSek * surchargeFactor).toFixed(2));
}

export function ruleMatchesScenario(rule: CarrierPriceRule, scenario: PricingScenario): boolean {
  const sameProduct = rule.productName.trim().toLowerCase() === scenario.productName.trim().toLowerCase();
  const annualPackagesMatch = scenario.annualPackages >= rule.customerAnnualPackagesMin && scenario.annualPackages <= rule.customerAnnualPackagesMax;
  const weightMatch = scenario.weightKg >= rule.weightMinKg && scenario.weightKg <= rule.weightMaxKg;
  const dimensionsMatch = scenario.lengthCm <= rule.maxLengthCm && scenario.widthCm <= rule.maxWidthCm && scenario.heightCm <= rule.maxHeightCm;
  return sameProduct && annualPackagesMatch && weightMatch && dimensionsMatch;
}

export function findScenarioMatches(settings: CarrierSettings[], scenario: PricingScenario): CarrierScenarioMatch[] {
  return normalizeCarrierSettings(settings)
    .map((carrier) => {
      const matchedRule = (carrier.priceRules || []).find((rule) => ruleMatchesScenario(rule, scenario));
      if (!matchedRule) return null;
      return {
        carrier,
        matchedRule,
        effectivePrice: calculateEffectivePrice(carrier, matchedRule)
      };
    })
    .filter(Boolean) as CarrierScenarioMatch[];
}

function selectRelevantCarriers(settings: CarrierSettings[], activeCarrier?: string): CarrierSettings[] {
  const normalized = normalizeCarrierSettings(settings);
  const activeCarrierMatch = activeCarrier
    ? normalized.filter((carrier) => carrier.name.trim().toLowerCase() === activeCarrier.trim().toLowerCase())
    : [];

  if (activeCarrierMatch.length) return activeCarrierMatch;

  const focusCarriers = normalized.filter((carrier) => carrier.isFocusCarrier);
  return focusCarriers.length ? focusCarriers : normalized;
}

function selectDefaultProductName(carriers: CarrierSettings[], preferredProductName?: string): string | undefined {
  if (preferredProductName?.trim()) return preferredProductName.trim();
  return carriers
    .flatMap((carrier) => carrier.priceRules || [])
    .map((rule) => rule.productName.trim())
    .find(Boolean);
}

function ruleSupportsPhysicalProfile(rule: CarrierPriceRule, scenario: PricingScenario): boolean {
  return scenario.weightKg >= rule.weightMinKg
    && scenario.weightKg <= rule.weightMaxKg
    && scenario.lengthCm <= rule.maxLengthCm
    && scenario.widthCm <= rule.maxWidthCm
    && scenario.heightCm <= rule.maxHeightCm;
}

function findClosestScenarioMatch(carriers: CarrierSettings[], scenario: PricingScenario): CarrierScenarioMatch | undefined {
  const directMatches = findScenarioMatches(carriers, scenario).sort((left, right) => left.effectivePrice - right.effectivePrice);
  if (directMatches.length) return directMatches[0];

  const sameProductRules = carriers.flatMap((carrier) =>
    (carrier.priceRules || [])
      .filter((rule) => rule.productName.trim().toLowerCase() === scenario.productName.trim().toLowerCase())
      .filter((rule) => ruleSupportsPhysicalProfile(rule, scenario))
      .map((rule) => ({
        carrier,
        matchedRule: rule,
        effectivePrice: calculateEffectivePrice(carrier, rule),
        distance:
          scenario.annualPackages < rule.customerAnnualPackagesMin
            ? rule.customerAnnualPackagesMin - scenario.annualPackages
            : scenario.annualPackages > rule.customerAnnualPackagesMax
              ? scenario.annualPackages - rule.customerAnnualPackagesMax
              : 0
      }))
  );

  sameProductRules.sort((left, right) => {
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.effectivePrice - right.effectivePrice;
  });

  const closest = sameProductRules[0];
  if (!closest) return undefined;

  return {
    carrier: closest.carrier,
    matchedRule: closest.matchedRule,
    effectivePrice: closest.effectivePrice
  };
}

function inferSeedPrice(carriers: CarrierSettings[], productName: string, scenario: PricingScenario): number | undefined {
  const matchingRules = carriers.flatMap((carrier) =>
    (carrier.priceRules || [])
      .filter((rule) => rule.productName.trim().toLowerCase() === productName.trim().toLowerCase())
      .filter((rule) => ruleSupportsPhysicalProfile(rule, scenario))
      .map((rule) => calculateEffectivePrice(carrier, rule))
  );

  if (matchingRules.length) {
    const averagePrice = matchingRules.reduce((sum, value) => sum + value, 0) / matchingRules.length;
    return Number(averagePrice.toFixed(2));
  }

  const carrierAverage = carriers.map((carrier) => carrier.avgPrice).find((value) => value > 0);
  return carrierAverage;
}

export function estimateAnnualPackagesFromBudget(
  settings: CarrierSettings[],
  shippingBudgetSEK: number,
  options: BudgetVolumeEstimateOptions = {}
): number | undefined {
  if (!Number.isFinite(shippingBudgetSEK) || shippingBudgetSEK <= 0) return undefined;

  const carriers = selectRelevantCarriers(settings, options.activeCarrier);
  if (!carriers.length) return undefined;

  const scenarioBase = {
    productName: selectDefaultProductName(carriers, options.productName),
    weightKg: options.weightKg ?? 3,
    lengthCm: options.lengthCm ?? 35,
    widthCm: options.widthCm ?? 25,
    heightCm: options.heightCm ?? 12
  };

  if (!scenarioBase.productName) return undefined;

  const seedScenario: PricingScenario = {
    ...scenarioBase,
    annualPackages: 10000
  };
  const seedPrice = inferSeedPrice(carriers, scenarioBase.productName, seedScenario);
  if (!seedPrice || seedPrice <= 0) return undefined;

  let annualPackagesEstimate = Math.max(1, Math.round(shippingBudgetSEK / seedPrice));

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const scenario: PricingScenario = {
      ...scenarioBase,
      annualPackages: annualPackagesEstimate
    };
    const closestMatch = findClosestScenarioMatch(carriers, scenario);
    if (!closestMatch || closestMatch.effectivePrice <= 0) {
      return annualPackagesEstimate;
    }

    const recalculatedEstimate = Math.max(1, Math.round(shippingBudgetSEK / closestMatch.effectivePrice));
    if (Math.abs(recalculatedEstimate - annualPackagesEstimate) <= 1) {
      return recalculatedEstimate;
    }
    annualPackagesEstimate = recalculatedEstimate;
  }

  return annualPackagesEstimate;
}

function normalizeKeyword(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function findSegmentDefaultProduct(products: string[], segment?: Segment): string | undefined {
  if (!segment) return undefined;
  const normalizedProducts = products.map((product) => ({
    value: product,
    normalized: product.trim().toLowerCase()
  }));

  if (segment === Segment.FS || segment === Segment.KAM) {
    return normalizedProducts.find((product) => /home|delivery|express|courier/.test(product.normalized))?.value;
  }

  if (segment === Segment.DM || segment === Segment.TS) {
    return normalizedProducts.find((product) => /locker|parcel|connect|ombud|pickup/.test(product.normalized))?.value;
  }

  return undefined;
}

function findVolumeBandProduct(settings: CarrierSettings[], annualPackages: number): string | undefined {
  const carriers = normalizeCarrierSettings(settings).sort((left, right) => Number(Boolean(right.isFocusCarrier)) - Number(Boolean(left.isFocusCarrier)));

  for (const carrier of carriers) {
    const rule = (carrier.priceRules || []).find((entry) => annualPackages >= entry.customerAnnualPackagesMin && annualPackages <= entry.customerAnnualPackagesMax);
    if (rule?.productName?.trim()) {
      return rule.productName.trim();
    }
  }

  return undefined;
}

export function selectPricingProductForLead(lead: LeadData, settings: CarrierSettings[]): PricingProductSelection {
  if (lead.pricingProductName?.trim()) {
    return {
      productName: lead.pricingProductName.trim(),
      source: lead.pricingProductSource || 'lead-product'
    };
  }

  const mappedProduct = matchMappedProduct(settings, lead);
  if (mappedProduct) {
    return {
      productName: mappedProduct,
      source: 'checkout-mapping'
    };
  }

  const serviceFromCheckout = lead.checkoutOptions?.find((option) => option.service)?.service?.trim();
  if (serviceFromCheckout) {
    return {
      productName: serviceFromCheckout,
      source: 'checkout-service'
    };
  }

  const annualPackages = lead.annualPackages || (lead.pos1Volume || 0) + (lead.pos2Volume || 0);
  const volumeBandProduct = annualPackages > 0 ? findVolumeBandProduct(settings, annualPackages) : undefined;
  if (volumeBandProduct) {
    return {
      productName: volumeBandProduct,
      source: 'volume-band'
    };
  }

  const configuredProducts = normalizeCarrierSettings(settings)
    .flatMap((carrier) => carrier.priceRules || [])
    .map((rule) => rule.productName.trim())
    .filter(Boolean);

  const segmentDefault = findSegmentDefaultProduct(configuredProducts, lead.segment);
  if (segmentDefault) {
    return {
      productName: segmentDefault,
      source: 'segment-default'
    };
  }

  return {
    productName: configuredProducts[0] || 'Parcel Connect',
    source: 'configured-default'
  };
}

function matchMappedProduct(settings: CarrierSettings[], lead: LeadData): string | undefined {
  const checkoutSignals = (lead.checkoutOptions || [])
    .flatMap((option) => [option.service, option.carrier])
    .map((value) => normalizeKeyword(value))
    .filter(Boolean);
  const deliverySignals = [lead.carriers, lead.checkoutSolution, lead.paymentProvider, lead.taSystem]
    .map((value) => normalizeKeyword(value))
    .filter(Boolean);

  for (const carrier of normalizeCarrierSettings(settings)) {
    for (const mapping of carrier.productMappings || []) {
      const checkoutKeyword = normalizeKeyword(mapping.checkoutKeyword);
      const deliveryKeyword = normalizeKeyword(mapping.deliveryMethodKeyword);
      const checkoutMatch = checkoutKeyword ? checkoutSignals.some((signal) => signal.includes(checkoutKeyword)) : false;
      const deliveryMatch = deliveryKeyword ? deliverySignals.some((signal) => signal.includes(deliveryKeyword)) : false;
      if (checkoutMatch || deliveryMatch) {
        return mapping.mappedProductName;
      }
    }
  }

  return undefined;
}

function inferAnnualPackages(lead: LeadData): number {
  if (lead.annualPackages && lead.annualPackages > 0) return lead.annualPackages;
  if (lead.pos1Volume || lead.pos2Volume) return (lead.pos1Volume || 0) + (lead.pos2Volume || 0);
  if (lead.estimatedAOV && lead.revenue) {
    const revenue = Number(String(lead.revenue).replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
    if (Number.isFinite(revenue) && revenue > 0) {
      const estimate = Math.round(revenue / lead.estimatedAOV);
      if (estimate > 0) return estimate;
    }
  }
  return 10000;
}

export function derivePricingScenarioFromLead(lead: LeadData, settings: CarrierSettings[]): PricingScenario {
  const productSelection = selectPricingProductForLead(lead, settings);
  return {
    productName: productSelection.productName,
    annualPackages: inferAnnualPackages(lead),
    ...DEFAULT_VOLUME_ONLY_PROFILE
  };
}

export function buildOfferRecommendation(settings: CarrierSettings[], lead: LeadData): OfferRecommendation {
  const scenario = derivePricingScenarioFromLead(lead, settings);
  return buildScenarioRecommendation(settings, scenario);
}

export function formatSek(value: number): string {
  return `${value.toFixed(2)} SEK`;
}

function escapeCsvValue(value: string | number | boolean | undefined): string {
  const stringValue = String(value ?? '');
  if (/[",\n;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportCarrierSettingsToCsv(settings: CarrierSettings[]): string {
  const headers = [
    'carrierName', 'isFocusCarrier', 'marketShare', 'avgPrice', 'dmt', 'sulfur', 'volumeOmbud', 'volumeSkap', 'volumeHem',
    'agentLocationCount', 'lockerLocationCount', 'homeDeliveryReachPeople',
    'networkCoverageSourceUrl', 'networkCoverageSourceLabel', 'networkCoverageCapturedAt', 'networkCoverageConfidence', 'networkCoverageSnippet',
    'productName', 'customerAnnualPackagesMin', 'customerAnnualPackagesMax', 'weightMinKg', 'weightMaxKg',
    'maxLengthCm', 'maxWidthCm', 'maxHeightCm', 'priceSek', 'ruleNotes',
    'checkoutKeyword', 'deliveryMethodKeyword', 'mappedProductName', 'mappingNotes'
  ];

  const rows = normalizeCarrierSettings(settings).flatMap((carrier) => {
    const rules = carrier.priceRules?.length ? carrier.priceRules : [createPriceRule({ priceSek: carrier.avgPrice || 0 })];
    const mappings = carrier.productMappings?.length ? carrier.productMappings : [createCarrierProductMapping()];
    const rowCount = Math.max(rules.length, mappings.length);

    return Array.from({ length: rowCount }, (_, index) => {
      const rule = rules[index];
      const mapping = mappings[index];
      return [
        carrier.name,
        carrier.isFocusCarrier ? 'true' : 'false',
        carrier.marketShare,
        carrier.avgPrice,
        carrier.dmt,
        carrier.sulfur,
        carrier.volumeOmbud,
        carrier.volumeSkap,
        carrier.volumeHem,
        carrier.agentLocationCount,
        carrier.lockerLocationCount,
        carrier.homeDeliveryReachPeople,
        carrier.networkCoverageSourceUrl,
        carrier.networkCoverageSourceLabel,
        carrier.networkCoverageCapturedAt,
        carrier.networkCoverageConfidence,
        carrier.networkCoverageSnippet,
        rule?.productName || '',
        rule?.customerAnnualPackagesMin ?? '',
        rule?.customerAnnualPackagesMax ?? '',
        rule?.weightMinKg ?? '',
        rule?.weightMaxKg ?? '',
        rule?.maxLengthCm ?? '',
        rule?.maxWidthCm ?? '',
        rule?.maxHeightCm ?? '',
        rule?.priceSek ?? '',
        rule?.notes || '',
        mapping?.checkoutKeyword || '',
        mapping?.deliveryMethodKeyword || '',
        mapping?.mappedProductName || '',
        mapping?.notes || ''
      ].map(escapeCsvValue).join(';');
    });
  });

  return [headers.join(';'), ...rows].join('\n');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ';' && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function numberOrUndefined(value: string | undefined): number | undefined {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function importCarrierSettingsFromCsv(csvText: string): CarrierSettings[] {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as Record<string, string>;
  });

  const carrierMap = new Map<string, CarrierSettings>();

  for (const row of rows) {
    const carrierName = row.carrierName?.trim();
    if (!carrierName) continue;

    if (!carrierMap.has(carrierName)) {
      carrierMap.set(carrierName, createCarrierSettings(carrierName, {
        isFocusCarrier: row.isFocusCarrier === 'true',
        marketShare: numberOrUndefined(row.marketShare) ?? 0,
        avgPrice: numberOrUndefined(row.avgPrice) ?? 0,
        dmt: numberOrUndefined(row.dmt) ?? 0,
        sulfur: numberOrUndefined(row.sulfur) ?? 0,
        volumeOmbud: numberOrUndefined(row.volumeOmbud) ?? 0,
        volumeSkap: numberOrUndefined(row.volumeSkap) ?? 0,
        volumeHem: numberOrUndefined(row.volumeHem) ?? 0,
        agentLocationCount: numberOrUndefined(row.agentLocationCount) ?? 0,
        lockerLocationCount: numberOrUndefined(row.lockerLocationCount) ?? 0,
        homeDeliveryReachPeople: numberOrUndefined(row.homeDeliveryReachPeople) ?? 0,
        networkCoverageSourceUrl: row.networkCoverageSourceUrl || '',
        networkCoverageSourceLabel: row.networkCoverageSourceLabel || '',
        networkCoverageCapturedAt: row.networkCoverageCapturedAt || '',
        networkCoverageConfidence: (row.networkCoverageConfidence as CarrierSettings['networkCoverageConfidence']) || 'missing',
        networkCoverageSnippet: row.networkCoverageSnippet || '',
        priceRules: [],
        productMappings: []
      }));
    }

    const carrier = carrierMap.get(carrierName)!;

    if (row.productName) {
      carrier.priceRules = [
        ...(carrier.priceRules || []),
        createPriceRule({
          productName: row.productName,
          customerAnnualPackagesMin: numberOrUndefined(row.customerAnnualPackagesMin) ?? 0,
          customerAnnualPackagesMax: numberOrUndefined(row.customerAnnualPackagesMax) ?? 0,
          weightMinKg: numberOrUndefined(row.weightMinKg) ?? 0,
          weightMaxKg: numberOrUndefined(row.weightMaxKg) ?? 0,
          maxLengthCm: numberOrUndefined(row.maxLengthCm) ?? 0,
          maxWidthCm: numberOrUndefined(row.maxWidthCm) ?? 0,
          maxHeightCm: numberOrUndefined(row.maxHeightCm) ?? 0,
          priceSek: numberOrUndefined(row.priceSek) ?? 0,
          notes: row.ruleNotes || ''
        })
      ];
    }

    if (row.mappedProductName || row.checkoutKeyword || row.deliveryMethodKeyword) {
      carrier.productMappings = [
        ...(carrier.productMappings || []),
        createCarrierProductMapping({
          checkoutKeyword: row.checkoutKeyword || '',
          deliveryMethodKeyword: row.deliveryMethodKeyword || '',
          mappedProductName: row.mappedProductName || row.productName || 'Parcel Connect',
          notes: row.mappingNotes || ''
        })
      ];
    }
  }

  return normalizeCarrierSettings(Array.from(carrierMap.values()));
}