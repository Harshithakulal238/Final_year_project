import express from 'express';
import dotenv from 'dotenv';
import { connectMongo, ObjectId } from './config/db.js';
import { evaluateSchemeEligibility } from './services/ruleEngine.js';
import { scoreEligibleSchemes } from './services/decisionTreeService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

function toNumber(value, defaultValue = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeUser(user) {
  if (!user) return {};

  return {
    _id: user._id,
    name: user.name || user.username || 'User',
    age: user.age,
    gender: user.gender,
    income: user.income,
    casteCategory: user.casteCategory || user.caste,
    employmentType: user.employmentType || user.occupation,
    district: user.district,
    qualification: user.qualification || user.education,
    specialConditions: user.specialConditions || [],
    studentStatus: user.studentStatus,
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
    const normalizedUser = normalizeUser(user);

    const eligibleSchemes = [];
    for (const scheme of schemes) {
      const ruleEvaluation = evaluateSchemeEligibility(normalizedUser, scheme);
      if (ruleEvaluation.eligible) {
        eligibleSchemes.push({
          ...scheme,
          ruleEvaluation,
        });
      }
    }

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
