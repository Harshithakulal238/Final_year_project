import express from 'express';
import dotenv from 'dotenv';
import { connectMongo, ObjectId } from './config/db.js';
import { evaluateSchemeEligibility } from './services/ruleEngine.js';
import { scoreEligibleSchemes } from './services/decisionTreeService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use((req, res, next) => {
  // Accept all local frontend ports during development. Vite chooses the next
  // free port when its default is occupied (for example, 5174 instead of 5173).
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(',');
  const origin = req.headers.origin;
  const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  if (origin && (allowedOrigins.includes(origin) || isLocalDevelopmentOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function toNumber(value, defaultValue = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function ageFromDob(dob) {
  if (!dob) return undefined;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const birthdayPending =
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (birthdayPending) age -= 1;
  return age >= 0 ? age : undefined;
}

function normalizeUser(user) {
  if (!user) return {};

  return {
    _id: user._id,
    name: user.name || user.username || 'User',
    age: user.age ?? ageFromDob(user.dob),
    gender: user.gender,
    income: user.income,
    casteCategory: user.casteCategory || user.caste,
    employmentType: user.employmentType || user.occupation,
    district: user.district || user.location?.district,
    qualification: user.qualification || user.education,
    specialConditions: user.specialConditions || user.conditions || [],
    studentStatus: user.studentStatus || (user.occupation === 'student' ? 'yes' : undefined),
    phone: user.phone,
    username: user.username,
  };
}

function buildRecommendationRecord(user, scheme, ruleEvaluation, decisionTreeScore) {
  const matchedRules = ruleEvaluation.matchedRules.length ? ruleEvaluation.matchedRules : ['None'];
  const failedRules = ruleEvaluation.failedRules.length ? ruleEvaluation.failedRules : ['None'];
  const explanation = ruleEvaluation.explanation.length ? ruleEvaluation.explanation : ['No rule-specific explanation available'];

  const ruleComponent = toNumber(ruleEvaluation.ruleScore, 0) / 100;
  const finalScore = Number((0.6 * ruleComponent + 0.4 * Number(decisionTreeScore || 0)).toFixed(4));

  return {
    schemeName: scheme.scheme_name || scheme.schemeName || scheme.name || 'Unknown Scheme',
    sourceUrl: scheme.source_url || scheme.url || scheme.schemeUrl || '',
    ruleScore: Number(ruleEvaluation.ruleScore || 0),
    decisionTreeScore: Number(decisionTreeScore || 0),
    finalScore,
    matchedRules: matchedRules === ['None'] ? [] : matchedRules,
    failedRules: failedRules === ['None'] ? [] : failedRules,
    explanation,
  };
}

function sortRecommendations(list) {
  return [...list].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)).slice(0, 10);
}

async function getSchemeCollection(db) {
  const candidates = ['Schemes', 'Scheme', 'schemes', 'scheme'];

  for (const collectionName of candidates) {
    try {
      const existing = await db.listCollections({ name: collectionName }).hasNext();
      if (existing) {
        return db.collection(collectionName);
      }
    } catch (error) {
      console.warn(`Unable to check collection: ${collectionName}`, error.message);
    }
  }

  const collections = await db.listCollections().toArray();
  const fallback = collections.find((collection) => /scheme/i.test(collection.name));

  return fallback ? db.collection(fallback.name) : null;
}

app.get('/api/recommend/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const db = await connectMongo();

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const schemeCollection = await getSchemeCollection(db);
    if (!schemeCollection) {
      return res.status(404).json({ message: 'No scheme collection found in the database' });
    }

    const schemes = await schemeCollection.find({}).toArray();
    console.log("==================================");
    console.log("Total schemes:", schemes.length);
    console.log("First scheme:", schemes[0]?.scheme_name);
    console.log("==================================");
    const normalizedUser = normalizeUser(user);
    console.log("Normalized User:");
    console.log(normalizedUser);
    const eligibleSchemes = [];
    for (const scheme of schemes) {

      const ruleEvaluation = evaluateSchemeEligibility(normalizedUser, scheme);

      console.log(
        "Scheme:",
        scheme.scheme_name,
        "| Eligible:",
        ruleEvaluation.eligible,
        "| Failed:",
        ruleEvaluation.failedRules
      );

      if (ruleEvaluation.eligible) {
        eligibleSchemes.push({
            ...scheme,
            ruleEvaluation,
        });
      }
    }
    console.log("Eligible schemes:", eligibleSchemes.length);

    if (!eligibleSchemes.length) {
      return res.json({
        user: { name: normalizedUser.name || normalizedUser.username || 'User' },
        recommendedSchemes: [],
      });
    }

    const pythonScores = await scoreEligibleSchemes({
      user: normalizedUser,
      schemes: eligibleSchemes,
    });

    const decisionMap = new Map();
    for (const score of pythonScores || []) {
      const key = score.source_url || score.scheme_url || score.schemeName || score.scheme_name || 'unknown';
      decisionMap.set(key, Number(score.decisionTreeScore || 0));
    }

    const recommendations = eligibleSchemes
      .map((scheme) => {
        const schemeKey = scheme.source_url || scheme.url || scheme.schemeName || scheme.scheme_name || 'unknown';
        const decisionTreeScore = decisionMap.get(schemeKey) ?? 0.5;
        const finalRecommendation = buildRecommendationRecord(
          normalizedUser,
          scheme,
          scheme.ruleEvaluation,
          decisionTreeScore
        );

        return finalRecommendation;
      })
      .filter((item) => item && item.finalScore > 0)
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    return res.json({
      user: { name: normalizedUser.name || normalizedUser.username || 'User' },
      recommendedSchemes: sortRecommendations(recommendations),
    });
  } catch (error) {
    console.error('Recommendation pipeline error:', error);
    return res.status(500).json({ message: 'Unable to generate recommendations', error: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await connectMongo();
    return res.json({ status: 'ok', database: process.env.DB_NAME || 'karnataka_schemes_enhance' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, async () => {
  try {
    await connectMongo();
    console.log(`Recommendation backend running on http://localhost:${PORT}`);
    console.log(`Connected to MongoDB database: ${process.env.DB_NAME || 'karnataka_schemes_enhance'}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
});
