
import { CarrierSettings, Segment, SNIPercentage } from '../types';
import { estimateAnnualPackagesFromBudget } from '../services/pricingService';

interface PricingMetricsOptions {
  marketSettings?: CarrierSettings[];
  activeCarrier?: string;
  productName?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

/**
 * SNI-Specifika konverteringsfaktorer (v24.7)
 * Procentandel av omsättning som går till frakt.
 */
export const SNI_CONVERSION_FACTORS: Record<string, number> = {
  "47911": 0.15, // Mode/Kläder (Hög paketfrekvens)
  "47912": 0.08, // Elektronik (Högre snittorder, färre paket)
  "47916": 0.12, // Heminredning
  "47750": 0.18, // Kosmetik (Många små paket)
  "default": 0.10
};

/**
 * SNI-Specifika AOV (Average Order Value) estimat (v24.8)
 */
export const SNI_AOV_ESTIMATES: Record<string, number> = {
  "47911": 1300, // Mode/Kläder
  "47912": 2500, // Elektronik
  "47916": 1800, // Heminredning
  "47750": 600,  // Kosmetik
  "default": 1000
};

/**
 * PERFORMILE STRATEGIC ENGINE (V.24.8)
 * Beräknar fraktpotential och marknadspositionering.
 */
export const calculateRickardMetrics = (
  revenueTKR: number,
  sniCode: string,
  customPercentages: SNIPercentage[] = [],
  marketCount: number = 1,
  pricingOptions?: PricingMetricsOptions
) => {
  if (!revenueTKR || revenueTKR <= 0) {
    return {
      potentialTKR: 0,
      shippingBudgetSEK: 0,
      annualPackages: 0,
      annualPackageEstimateSource: 'default-fallback' as const,
      pos1Volume: 0,
      pos2Volume: 0,
      percentage: 5,
      conversionFactor: 0.10,
      marketPosition: "Okänd",
      estimatedAOV: 1000
    };
  }

  // Rensa SNI-kod för matchning
  const cleanSNI = sniCode.replace(/\D/g, '');
  const factor = SNI_CONVERSION_FACTORS[cleanSNI] || 
                 SNI_CONVERSION_FACTORS[cleanSNI.substring(0, 5)] || 
                 SNI_CONVERSION_FACTORS[cleanSNI.substring(0, 2)] || 
                 SNI_CONVERSION_FACTORS.default;
  
  const aov = SNI_AOV_ESTIMATES[cleanSNI] || 
              SNI_AOV_ESTIMATES[cleanSNI.substring(0, 5)] || 
              SNI_AOV_ESTIMATES[cleanSNI.substring(0, 2)] || 
              SNI_AOV_ESTIMATES.default;

  const totalRevenueSEK = revenueTKR * 1000;
  const shippingBudgetSEK = totalRevenueSEK * factor;
  const totalPackages = Math.round(totalRevenueSEK / aov);
  
  // Estimera svenska paket (Sverige antas vara huvudmarknad, ca 70% om flera marknader finns)
  // Om marketCount är 1, är alla paket i Sverige.
  // Om marketCount > 1, antar vi att Sverige är 70% och resten delas på övriga.
  const swedenWeight = marketCount > 1 ? 0.7 : 1.0;
  const swedenShippingBudgetSEK = shippingBudgetSEK * swedenWeight;
  const pricingModelEstimate = pricingOptions?.marketSettings?.length
    ? estimateAnnualPackagesFromBudget(pricingOptions.marketSettings, swedenShippingBudgetSEK, {
        activeCarrier: pricingOptions.activeCarrier,
        productName: pricingOptions.productName,
        weightKg: pricingOptions.weightKg,
        lengthCm: pricingOptions.lengthCm,
        widthCm: pricingOptions.widthCm,
        heightCm: pricingOptions.heightCm
      })
    : undefined;
  const annualPackages = pricingModelEstimate ?? Math.round(totalPackages * swedenWeight);

  // Marknadspositionering (baserat på 50 000 svenska e-handlare)
  let marketPosition = "Nisch-aktör";
  const revenueMSEK = revenueTKR / 1000;
  if (revenueMSEK >= 100) marketPosition = "Top-Tier (Topp 2.4%)";
  else if (revenueMSEK >= 5) marketPosition = "Professionell (Topp 24%)";

  return {
    shippingBudgetSEK,
    potentialTKR: Math.round(shippingBudgetSEK / 1000),
    annualPackages: annualPackages,
    annualPackageEstimateSource: pricingModelEstimate ? 'pricing-model' as const : 'aov-fallback' as const,
    pos1Volume: Math.round(annualPackages * 0.60),
    pos2Volume: Math.round(annualPackages * 0.22),
    percentage: Math.round(factor * 100),
    conversionFactor: factor,
    marketPosition,
    estimatedAOV: aov
  };
};

export const determineSegmentByPotential = (shippingBudgetSEK: number): Segment => {
  if (shippingBudgetSEK >= 5000000) return Segment.KAM;
  if (shippingBudgetSEK >= 750000) return Segment.FS;
  if (shippingBudgetSEK >= 250000) return Segment.TS;
  return Segment.DM;
};
