import { Decimal } from '@prisma/client/runtime/library'

export interface WaterTierSettings {
  // Residential
  waterResTier1Max: number
  waterResTier1Rate: number
  waterResTier2Max: number
  waterResTier2Rate: number
  waterResTier3Max: number
  waterResTier3Rate: number
  waterResTier4Max: number
  waterResTier4Rate: number
  waterResTier5Max: number
  waterResTier5Rate: number
  waterResTier6Max: number
  waterResTier6Rate: number
  waterResTier7Rate: number
  
  // Commercial
  waterComTier1Max: number
  waterComTier1Rate: number
  waterComTier2Max: number
  waterComTier2Rate: number
  waterComTier3Max: number
  waterComTier3Rate: number
  waterComTier4Max: number
  waterComTier4Rate: number
  waterComTier5Max: number
  waterComTier5Rate: number
  waterComTier6Max: number
  waterComTier6Rate: number
  waterComTier7Rate: number
}

/**
 * Calculate water bill for RESIDENTIAL units
 * Exact formula from Excel: 2F Sheet
 *
 * =IF(J9<=1, 80,
 *   IF(AND((J9>1),(J9<6)), 200,
 *     IF(AND((J9>5),(J9<11)), 370,
 *       IF(AND((J9>10),(J9<21)), ((J9-10)*40+370),
 *         IF(AND((J9>20),(J9<31)), ((J9-20)*45+770),
 *           IF(AND((J9>30),(J9<41)), (((J9-30)*50+1220)),
 *             ((J9-40)*55+1720)))))))
 *
 * IMPORTANT: Excel uses FIXED subtraction values (10, 20, 30, 40) in the formulas.
 * These are NOT the same as tier boundary settings which are used for conditions only.
 */
export function calculateResidentialWater(
  consumption: number,
  settings: WaterTierSettings
): number {
  const cons = consumption

  // Tier 1: <=1 cu.m = Fixed ₱80
  if (cons <= settings.waterResTier1Max) {
    return settings.waterResTier1Rate
  }

  // Tier 2: >1 AND <6 = Fixed ₱200
  if (cons > settings.waterResTier1Max && cons < settings.waterResTier2Max) {
    return settings.waterResTier2Rate
  }

  // Tier 3: >=6 AND <11 = Fixed ₱370
  if (cons >= settings.waterResTier2Max && cons < settings.waterResTier3Max) {
    return settings.waterResTier3Rate
  }

  // Tier 4: >=11 AND <21 = (cons-10)*40 + 370
  // IMPORTANT: Excel uses fixed value 10 for subtraction, NOT the tier boundary
  if (cons >= settings.waterResTier3Max && cons < settings.waterResTier4Max) {
    return (cons - 10) * settings.waterResTier4Rate + settings.waterResTier3Rate
  }

  // Tier 5: >=21 AND <31 = (cons-20)*45 + 770
  if (cons >= settings.waterResTier4Max && cons < settings.waterResTier5Max) {
    return (cons - 20) * settings.waterResTier5Rate + 770
  }

  // Tier 6: >=31 AND <41 = (cons-30)*50 + 1220
  if (cons >= settings.waterResTier5Max && cons < settings.waterResTier6Max) {
    return (cons - 30) * settings.waterResTier6Rate + 1220
  }

  // Tier 7: >=41 = (cons-40)*55 + 1720
  return (cons - 40) * settings.waterResTier7Rate + 1720
}

/**
 * Calculate water bill for COMMERCIAL units
 * Exact formula from Excel: GF Sheet
 *
 * =IF(J9<=1, 200,
 *   IF(AND((J9>1),(J9<6)), 250,
 *     IF(AND((J9>5),(J9<11)), 740,
 *       IF(AND((J9>10),(J9<21)), ((J9-10)*55+740),
 *         IF(AND((J9>20),(J9<31)), ((J9-20)*60+1290),
 *           IF(AND((J9>30),(J9<41)), (((J9-30)*65+1890)),
 *             ((J9-40)*85+2540)))))))
 *
 * IMPORTANT: Excel uses FIXED subtraction values (10, 20, 30, 40) in the formulas.
 * These are NOT the same as tier boundary settings which are used for conditions only.
 */
export function calculateCommercialWater(
  consumption: number,
  settings: WaterTierSettings
): number {
  const cons = consumption

  // Tier 1: <=1 cu.m = Fixed ₱200
  if (cons <= settings.waterComTier1Max) {
    return settings.waterComTier1Rate
  }

  // Tier 2: >1 AND <6 = Fixed ₱250
  if (cons > settings.waterComTier1Max && cons < settings.waterComTier2Max) {
    return settings.waterComTier2Rate
  }

  // Tier 3: >=6 AND <11 = Fixed ₱740
  if (cons >= settings.waterComTier2Max && cons < settings.waterComTier3Max) {
    return settings.waterComTier3Rate
  }

  // Tier 4: >=11 AND <21 = (cons-10)*55 + 740
  // IMPORTANT: Excel uses fixed value 10 for subtraction, NOT the tier boundary
  if (cons >= settings.waterComTier3Max && cons < settings.waterComTier4Max) {
    return (cons - 10) * settings.waterComTier4Rate + settings.waterComTier3Rate
  }

  // Tier 5: >=21 AND <31 = (cons-20)*60 + 1290
  if (cons >= settings.waterComTier4Max && cons < settings.waterComTier5Max) {
    return (cons - 20) * settings.waterComTier5Rate + 1290
  }

  // Tier 6: >=31 AND <41 = (cons-30)*65 + 1890
  if (cons >= settings.waterComTier5Max && cons < settings.waterComTier6Max) {
    return (cons - 30) * settings.waterComTier6Rate + 1890
  }

  // Tier 7: >=41 = (cons-40)*85 + 2540
  return (cons - 40) * settings.waterComTier7Rate + 2540
}

/**
 * Main water calculation function
 */
export function calculateWaterBill(
  consumption: number,
  unitType: 'RESIDENTIAL' | 'COMMERCIAL',
  settings: WaterTierSettings
): number {
  if (unitType === 'RESIDENTIAL') {
    return calculateResidentialWater(consumption, settings)
  } else {
    return calculateCommercialWater(consumption, settings)
  }
}

/**
 * Get water tier breakdown for display
 */
export function getWaterTierBreakdown(
  consumption: number,
  unitType: 'RESIDENTIAL' | 'COMMERCIAL',
  settings: WaterTierSettings
): Array<{ tier: number; range: string; rate: number; amount: number }> {
  const breakdown = []
  
  if (unitType === 'RESIDENTIAL') {
    // Add tiers up to consumption
    if (consumption <= 1) {
      breakdown.push({ tier: 1, range: '0-1 cu.m', rate: 80, amount: 80 })
    } else if (consumption <= 5) {
      breakdown.push({ tier: 2, range: '1-5 cu.m', rate: 200, amount: 200 })
    } else if (consumption <= 10) {
      breakdown.push({ tier: 3, range: '5-10 cu.m', rate: 370, amount: 370 })
    } else if (consumption <= 20) {
      const tierAmount = 370 + (consumption - 10) * 40
      breakdown.push({ tier: 4, range: '10-20 cu.m', rate: 40, amount: tierAmount })
    } else if (consumption <= 30) {
      const tierAmount = 770 + (consumption - 20) * 45
      breakdown.push({ tier: 5, range: '20-30 cu.m', rate: 45, amount: tierAmount })
    } else if (consumption <= 40) {
      const tierAmount = 1220 + (consumption - 30) * 50
      breakdown.push({ tier: 6, range: '30-40 cu.m', rate: 50, amount: tierAmount })
    } else {
      const tierAmount = 1720 + (consumption - 40) * 55
      breakdown.push({ tier: 7, range: '40+ cu.m', rate: 55, amount: tierAmount })
    }
  } else {
    // Commercial tiers
    if (consumption <= 1) {
      breakdown.push({ tier: 1, range: '0-1 cu.m', rate: 200, amount: 200 })
    } else if (consumption <= 5) {
      breakdown.push({ tier: 2, range: '1-5 cu.m', rate: 250, amount: 250 })
    } else if (consumption <= 10) {
      breakdown.push({ tier: 3, range: '5-10 cu.m', rate: 740, amount: 740 })
    } else if (consumption <= 20) {
      const tierAmount = 740 + (consumption - 10) * 55
      breakdown.push({ tier: 4, range: '10-20 cu.m', rate: 55, amount: tierAmount })
    } else if (consumption <= 30) {
      const tierAmount = 1290 + (consumption - 20) * 60
      breakdown.push({ tier: 5, range: '20-30 cu.m', rate: 60, amount: tierAmount })
    } else if (consumption <= 40) {
      const tierAmount = 1890 + (consumption - 30) * 65
      breakdown.push({ tier: 6, range: '30-40 cu.m', rate: 65, amount: tierAmount })
    } else {
      const tierAmount = 2540 + (consumption - 40) * 85
      breakdown.push({ tier: 7, range: '40+ cu.m', rate: 85, amount: tierAmount })
    }
  }
  
  return breakdown
}
