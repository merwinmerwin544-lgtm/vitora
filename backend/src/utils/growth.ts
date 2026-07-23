// WHO Child Growth Standards Interpolation (Ages 24-60 months, Height 65-120cm)

interface Milestone {
  key: number; // age in months or height in cm
  median: number;
  sd: number;
}

// Boys Height-for-Age milestones
const boysHeightForAge: Milestone[] = [
  { key: 0, median: 49.9, sd: 2.0 },
  { key: 6, median: 67.6, sd: 2.5 },
  { key: 12, median: 75.7, sd: 2.8 },
  { key: 24, median: 87.8, sd: 3.5 },
  { key: 36, median: 96.1, sd: 3.9 },
  { key: 48, median: 103.3, sd: 4.3 },
  { key: 60, median: 110.0, sd: 4.7 }
];

// Girls Height-for-Age milestones
const girlsHeightForAge: Milestone[] = [
  { key: 0, median: 49.1, sd: 1.9 },
  { key: 6, median: 65.7, sd: 2.4 },
  { key: 12, median: 74.0, sd: 2.7 },
  { key: 24, median: 86.4, sd: 3.5 },
  { key: 36, median: 95.1, sd: 3.8 },
  { key: 48, median: 102.7, sd: 4.2 },
  { key: 60, median: 109.4, sd: 4.6 }
];

// Boys Weight-for-Height milestones (height in cm -> weight in kg)
const boysWeightForHeight: Milestone[] = [
  { key: 65, median: 7.4, sd: 0.6 },
  { key: 75, median: 9.5, sd: 0.8 },
  { key: 85, median: 11.5, sd: 1.0 },
  { key: 95, median: 13.8, sd: 1.2 },
  { key: 105, median: 16.5, sd: 1.5 },
  { key: 115, median: 19.9, sd: 1.8 },
  { key: 120, median: 22.0, sd: 2.1 }
];

// Girls Weight-for-Height milestones (height in cm -> weight in kg)
const girlsWeightForHeight: Milestone[] = [
  { key: 65, median: 6.9, sd: 0.6 },
  { key: 75, median: 8.9, sd: 0.8 },
  { key: 85, median: 10.8, sd: 1.0 },
  { key: 95, median: 13.0, sd: 1.2 },
  { key: 105, median: 15.6, sd: 1.5 },
  { key: 115, median: 18.9, sd: 1.8 },
  { key: 120, median: 21.0, sd: 2.1 }
];

function interpolate(value: number, milestones: Milestone[]): { median: number; sd: number } {
  // If value is outside milestones, clamp it
  if (value <= milestones[0].key) {
    return { median: milestones[0].median, sd: milestones[0].sd };
  }
  const lastIdx = milestones.length - 1;
  if (value >= milestones[lastIdx].key) {
    return { median: milestones[lastIdx].median, sd: milestones[lastIdx].sd };
  }

  // Find surrounding milestones
  for (let i = 0; i < lastIdx; i++) {
    const m1 = milestones[i];
    const m2 = milestones[i + 1];
    if (value >= m1.key && value <= m2.key) {
      const fraction = (value - m1.key) / (m2.key - m1.key);
      const median = m1.median + fraction * (m2.median - m1.median);
      const sd = m1.sd + fraction * (m2.sd - m1.sd);
      return { median, sd };
    }
  }
  return { median: milestones[0].median, sd: milestones[0].sd };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export function calculateHeightForAgeZ(ageMonths: number, heightCm: number, gender: string): number {
  const milestones = gender.toUpperCase() === "MALE" || gender.toUpperCase() === "BOY"
    ? boysHeightForAge
    : girlsHeightForAge;
  const { median, sd } = interpolate(ageMonths, milestones);
  const zScore = (heightCm - median) / sd;
  return Number(zScore.toFixed(2));
}

export function calculateWeightForHeightZ(heightCm: number, weightKg: number, gender: string): number {
  const milestones = gender.toUpperCase() === "MALE" || gender.toUpperCase() === "BOY"
    ? boysWeightForHeight
    : girlsWeightForHeight;
  const { median, sd } = interpolate(heightCm, milestones);
  const zScore = (weightKg - median) / sd;
  return Number(zScore.toFixed(2));
}

export function evaluateClinicalRiskScore(
  bmi: number,
  muacCm: number,
  wzh: number, // Weight-for-Height Z-score
  haz: number  // Height-for-Age Z-score
): { score: number; details: string } {
  // Clinical parameters contribute 70% of the overall prediction.
  // We return a raw clinical score out of 100 based on standard malnutrition indicators.
  // Indicators:
  // MUAC: Normal > 12.5 cm, Moderate Risk 11.5 - 12.5 cm, High Risk < 11.5 cm
  // Weight-for-Height Z-score (Wasting): Normal > -2, Moderate -3 to -2, High < -3
  // Height-for-Age Z-score (Stunting): Normal > -2, Moderate -3 to -2, High < -3
  
  let points = 0;
  let maxPoints = 30; // 10 points for MUAC, 10 for Wasting Z-score, 10 for Stunting Z-score
  
  // 1. MUAC Evaluation
  if (muacCm < 11.5) {
    points += 10; // High severity
  } else if (muacCm >= 11.5 && muacCm <= 12.5) {
    points += 5;  // Moderate severity
  }
  
  // 2. Weight-for-Height Z-score (Wasting)
  if (wzh < -3.0) {
    points += 10;
  } else if (wzh >= -3.0 && wzh <= -2.0) {
    points += 5;
  }
  
  // 3. Height-for-Age Z-score (Stunting)
  if (haz < -3.0) {
    points += 10;
  } else if (haz >= -3.0 && haz <= -2.0) {
    points += 5;
  }
  
  // Convert points to a score from 0 (healthy) to 100 (extreme high risk)
  const clinicalScore = (points / maxPoints) * 100;
  
  let details = "";
  if (clinicalScore >= 66) {
    details = "Severe clinical malnutrition risk indicators detected.";
  } else if (clinicalScore >= 33) {
    details = "Moderate clinical malnutrition risk indicators detected.";
  } else {
    details = "Clinical parameters are within normal growth patterns.";
  }
  
  return {
    score: Number(clinicalScore.toFixed(2)),
    details
  };
}
