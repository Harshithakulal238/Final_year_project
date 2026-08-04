import { SCHEMES, type Scheme } from "./schemes";

export type Profile = {
  name: string;
  mobile: string;
  verified: boolean; // OTP verified
  dob: string; // ISO yyyy-mm-dd
  gender: "male" | "female" | "other";
  income: number; // annual INR
  rationCard: "APL" | "BPL" | "AAY" | "None";
  caste: "General" | "OBC" | "SC" | "ST" | "Minority";
  minorityType?: string; // e.g. Muslim, Christian, Sikh, Jain, Buddhist, Parsi, Other
  occupation: string;
  conditions: string[]; // pregnant, widow, disabled (optional)
  location: {
    state: string;
    district: string;
    taluk: string;
    village: string;
    pincode: string;
  };
};

export function getAge(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export type EligibilityResult = {
  scheme: Scheme;
  eligible: boolean;
  score: number; // 0..100
  reasons: string[]; // matched reasons
  rejections: string[]; // rejection reasons
  explanation: string;
};

export function ageGroup(age: number) {
  if (age < 18) return "minor";
  if (age < 30) return "youth";
  if (age < 45) return "adult";
  if (age < 60) return "middle-aged";
  return "senior";
}

export function incomeCategory(income: number) {
  if (income < 100000) return "very-low";
  if (income < 250000) return "low";
  if (income < 500000) return "middle";
  return "high";
}

export function checkScheme(profile: Profile, scheme: Scheme): EligibilityResult {
  const e = scheme.eligibility;
  const reasons: string[] = [];
  const rejections: string[] = [];
  let score = 0;
  const age = getAge(profile.dob);

  // Age
  if (e.minAge !== undefined && age < e.minAge) {
    rejections.push(`Minimum age required is ${e.minAge}`);
  } else if (e.maxAge !== undefined && age > e.maxAge) {
    rejections.push(`Maximum age allowed is ${e.maxAge}`);
  } else if (e.minAge !== undefined || e.maxAge !== undefined) {
    reasons.push(`Age ${age} matches the eligible range`);
    score += 20;
  }

  // Gender
  if (e.gender && e.gender !== "any") {
    if (profile.gender !== e.gender) {
      rejections.push(`Scheme is for ${e.gender} beneficiaries`);
    } else {
      reasons.push(`Gender match (${e.gender})`);
      score += 20;
    }
  }

  // Income
  if (e.maxIncome !== undefined) {
    if (profile.income > e.maxIncome) {
      rejections.push(`Annual income exceeds ₹${e.maxIncome.toLocaleString("en-IN")}`);
    } else {
      reasons.push(`Income within ₹${e.maxIncome.toLocaleString("en-IN")} limit`);
      score += 20;
    }
  }

  // Ration card
  if (e.rationCard && !e.rationCard.includes("any" as never)) {
    if (!e.rationCard.includes(profile.rationCard as never)) {
      rejections.push(`Requires ${e.rationCard.join("/")} ration card`);
    } else {
      reasons.push(`${profile.rationCard} ration card qualifies`);
      score += 10;
    }
  }

  // Caste
  if (e.caste && !e.caste.includes("any" as never)) {
    if (!e.caste.includes(profile.caste as never)) {
      rejections.push(`Reserved for ${e.caste.join("/")} category`);
    } else {
      reasons.push(`${profile.caste} category eligible`);
      score += 10;
    }
  }

  // Occupation
  if (e.occupation && e.occupation.length) {
    if (!e.occupation.includes(profile.occupation)) {
      rejections.push(`Meant for ${e.occupation.join("/")}`);
    } else {
      reasons.push(`Occupation match (${profile.occupation})`);
      score += 10;
    }
  }

  // Conditions
  if (e.conditions && e.conditions.length) {
    const missing = e.conditions.filter((c) => !profile.conditions.includes(c));
    if (missing.length) {
      rejections.push(`Requires: ${missing.join(", ")}`);
    } else {
      reasons.push(`Special status matched: ${e.conditions.join(", ")}`);
      score += 20;
    }
  }

  const eligible = rejections.length === 0;
  if (!eligible) score = Math.max(0, score - 10 * rejections.length);

  // Boost by target group matches
  const groupHints: string[] = [];
  if (profile.gender === "female") groupHints.push("women");
  if (age >= 60) groupHints.push("elderly");
  if (incomeCategory(profile.income) === "very-low" || incomeCategory(profile.income) === "low")
    groupHints.push("low-income");
  groupHints.push(...profile.conditions);
  groupHints.push(profile.occupation);
  if (profile.caste === "Minority") {
    groupHints.push("minority");
    if (profile.minorityType) groupHints.push(profile.minorityType.toLowerCase());
  }
  const overlap = scheme.targetGroup.filter((g) => groupHints.includes(g)).length;
  score += overlap * 5;
  score = Math.min(100, score);

  const explanation = eligible
    ? `You qualify because ${reasons.slice(0, 3).join("; ").toLowerCase()}.`
    : `Not eligible — ${rejections[0].toLowerCase()}.`;

  return { scheme, eligible, score, reasons, rejections, explanation };
}

export function evaluateAll(profile: Profile) {
  const results = SCHEMES.map((s) => checkScheme(profile, s));
  const eligible = results.filter((r) => r.eligible).sort((a, b) => b.score - a.score);
  const ineligible = results.filter((r) => !r.eligible).sort((a, b) => b.score - a.score);
  return { eligible, ineligible, all: results };
}

export function confidenceScore(profile: Profile): { level: "Low" | "Medium" | "High"; pct: number; notes: string[] } {
  let pts = 30;
  const notes: string[] = [];
  if (profile.verified) {
    pts += 30;
    notes.push("Mobile OTP verified");
  } else {
    notes.push("Guest session — OTP not verified");
  }
  const loc = profile.location;
  const locFilled =
    loc && loc.state && loc.district && loc.taluk && loc.village && loc.pincode;
  if (locFilled) {
    pts += 15;
    notes.push(`Location: ${loc.village}, ${loc.district}`);
  }
  // cross-field
  const inconsistencies = crossFieldIssues(profile);
  pts -= inconsistencies.length * 15;
  inconsistencies.forEach((i) => notes.push(`⚠ ${i}`));
  pts = Math.max(10, Math.min(100, pts));
  const level = pts >= 75 ? "High" : pts >= 50 ? "Medium" : "Low";
  return { level, pct: pts, notes };
}

export function crossFieldIssues(profile: Profile): string[] {
  const issues: string[] = [];
  const age = getAge(profile.dob);
  if (profile.rationCard === "BPL" && profile.income > 250000)
    issues.push("BPL ration card with income above ₹2.5L looks inconsistent");
  if (profile.rationCard === "AAY" && profile.income > 150000)
    issues.push("AAY ration card with income above ₹1.5L looks inconsistent");
  if (profile.conditions.includes("pregnant") && profile.gender !== "female")
    issues.push("Pregnancy status requires female gender");
  if (profile.conditions.includes("widow") && profile.gender !== "female")
    issues.push("Widow status requires female gender");
  if (profile.occupation === "student" && age > 40)
    issues.push("Student occupation with age above 40 is uncommon");
  return issues;
}