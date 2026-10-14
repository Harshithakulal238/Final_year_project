import express from 'express';

import crypto from 'crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { connectMongo, ObjectId } from './config/db.js';

import { evaluateSchemeEligibility } from './services/ruleEngine.js';

import { rankEligibleScheme } from './services/recommendationRanking.js';
import { getTfIdfRecommendations } from './TF_IDF/tfidfRecommendation.js';

 

dotenv.config();

 

const app = express();

const PORT = process.env.PORT || 5000;
const chatbotScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'chatbot',
  'chatbot.py',
);

 

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

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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

function decryptStoredProfile(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const [ivPart, encryptedData] = payload.split(':');
    if (!ivPart || !encryptedData) return null;
    const key = crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY || 'change_this_to_a_32_byte_key')).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivPart, 'base64'));
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    const profile = JSON.parse(decrypted);
    return profile && typeof profile === 'object' ? profile : null;
  } catch {
    return null;
  }
}

 

function normalizeUser(user) {

  if (!user) return {};

  // Authentication stores historical profiles encrypted, while newer saves
  // also flatten the same structured fields. Read either representation.
  const storedProfile = decryptStoredProfile(user.profile);
  const source = { ...(storedProfile || {}), ...user };

 

  const caste = source.caste || source.casteCategory;

  const occupation = source.occupation || source.employmentType;

  const education = source.education || source.qualification;

  const conditions = source.conditions || source.specialConditions || [];

  const district = source.location?.district || source.district;

 

  return {

    _id: user._id,

    name: user.name || user.username || 'User',

    age: source.age ?? ageFromDob(source.dob),

    dob: source.dob,

    gender: source.gender,

    income: source.income,

    caste,

    casteCategory: caste,

    occupation,

    employmentType: occupation,

    education,

    qualification: education,

    conditions,

    specialConditions: conditions,

    rationCard: source.rationCard,

    location: {

      state: source.location?.state,

      district,

    },

    district,

    studentStatus: source.studentStatus || (occupation === 'student' ? 'yes' : undefined),

    phone: source.phone,

    username: user.username,

  };

}

 

function buildRecommendationRecord(user, scheme, ruleEvaluation) {

  const matchedRules = ruleEvaluation.ruleDetails
    .filter((rule) => rule.applicable && rule.eligible)
    .map((rule) => rule.name);

  const failedRules = ruleEvaluation.failedRules.length ? ruleEvaluation.failedRules : ['None'];

  const purposeSource = scheme.objective || scheme.benefits || scheme.description;
  const purpose = purposeSource
    ? String(purposeSource).replace(/\s+/g, ' ').trim().slice(0, 260)
    : 'A purpose or benefit was not captured in the scheme data.';
  const matchedExplanations = ruleEvaluation.ruleDetails
    .filter((rule) => rule.applicable && rule.eligible)
    .flatMap((rule) => rule.explanation || [])
    .slice(0, 4);
  const explanation = [
    `What is this scheme? ${purpose}`,
    `Why are you eligible? ${matchedExplanations.join('; ') || 'Your recorded profile matches the scheme fields.'}`,
  ];

 

  const ranking = rankEligibleScheme(user, scheme, ruleEvaluation);

 

  return {

    schemeName: scheme.scheme_name || scheme.schemeName || scheme.name || 'Unknown Scheme',

    sourceUrl: scheme.source_url || scheme.url || scheme.schemeUrl || '',

    ruleScore: Number(ruleEvaluation.ruleScore || 0),

    decisionTreeScore: null,

    finalScore: ranking.finalScore,

    ranking,

    matchedRules,

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

async function getUserCollection(db) {
  const collections = await db.listCollections().toArray();
  const match = collections.find((collection) => /^users?$/i.test(collection.name))
    || collections.find((collection) => /user/i.test(collection.name));
  return match ? db.collection(match.name) : null;
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function runChatbot(payload) {
  return new Promise((resolve, reject) => {
    const pythonBinary = process.env.PYTHON_BIN || 'python';
    const child = spawn(pythonBinary, [chatbotScript], {
      cwd: path.dirname(chatbotScript),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputTooLarge = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 55000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 1024 * 1024) {
        outputTooLarge = true;
        child.kill();
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return reject(new Error('Chatbot request timed out'));
      if (outputTooLarge) return reject(new Error('Chatbot response exceeded the output limit'));
      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(stderr.trim() || `Chatbot process exited with code ${code}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (typeof result.reply !== 'string' || !result.reply.trim()) {
          return reject(new Error('Chatbot returned an invalid response'));
        }
        return resolve(result);
      } catch (error) {
        return reject(new Error(`Unable to parse chatbot response: ${error.message}`));
      }
    });
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') reject(error);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

app.post('/api/chat', async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'At least one chat message is required' });
  }

  const validMessages = messages.filter((message) =>
    message
    && ['user', 'assistant'].includes(message.role)
    && typeof message.content === 'string'
    && message.content.trim()
    && message.content.length <= 4000
  );
  if (!validMessages.length || validMessages[validMessages.length - 1].role !== 'user') {
    return res.status(400).json({ message: 'A non-empty user message is required' });
  }
  if (!process.env.TEXT_API_KEY) {
    return res.status(503).json({ message: 'TEXT_API_KEY is not configured on the server' });
  }

  try {
    const db = await connectMongo();
    const schemeCollection = await getSchemeCollection(db);
    if (!schemeCollection) {
      return res.status(404).json({ message: 'No scheme collection found in the database' });
    }

    const schemeRecords = await schemeCollection.find({}).toArray();
    const schemes = schemeRecords.map((scheme) => ({
      scheme_name: scheme.scheme_name || scheme.schemeName || scheme.title || scheme.name,
      source_url: scheme.source_url || scheme.scheme_url || scheme.schemeUrl || scheme.url,
      summary: scheme.summary,
      objective: scheme.objective,
      description: scheme.description,
      overview: scheme.overview,
      benefits: scheme.benefits,
      eligibility: scheme.eligibility,
      eligibility_criteria: scheme.eligibility_criteria,
      documents: scheme.documents,
      documents_required: scheme.documents_required,
      required_documents: scheme.required_documents,
      how_to_apply: scheme.how_to_apply,
      application_process: scheme.application_process,
      process: scheme.process,
      category: scheme.category,
      categories: scheme.categories,
      scheme_category: scheme.scheme_category,
      scheme_type: scheme.scheme_type,
    }));
    const result = await runChatbot({ messages: validMessages.slice(-10), schemes });
    return res.json(result);
  } catch (error) {
    console.error('Chatbot request failed:', error);
    if (error.code === 'ENOENT') {
      return res.status(503).json({ message: 'Python is unavailable; configure PYTHON_BIN on the backend' });
    }
    if (error.message === 'Chatbot request timed out') {
      return res.status(504).json({ message: 'The chatbot took too long to respond. Please try again.' });
    }
    if (error.name === 'MongoServerSelectionError' || /server selection timed out/i.test(error.message || '')) {
      return res.status(503).json({ message: 'Unable to connect to the scheme database. Check MONGODB_URI and database availability.' });
    }
    if (/Chat provider returned HTTP 401/.test(error.message || '')) {
      return res.status(502).json({ message: 'The AI provider rejected TEXT_API_KEY. Check that it is valid and active.' });
    }
    if (/Chat provider returned HTTP 429/.test(error.message || '')) {
      return res.status(429).json({ message: 'The AI provider is rate-limiting requests. Please try again shortly.' });
    }
    if (/Chat provider returned HTTP 5\d\d/.test(error.message || '') || error.message === 'Unable to reach the chat provider') {
      return res.status(502).json({ message: 'The AI provider is temporarily unavailable. Please try again shortly.' });
    }
    return res.status(502).json({ message: 'Unable to generate a chatbot response. Check the backend log for the chatbot request error.' });
  }
});

app.get('/api/schemes', async (_req, res) => {
  try {
    const db = await connectMongo();
    const schemeCollection = await getSchemeCollection(db);
    if (!schemeCollection) {
      return res.status(404).json({ message: 'No scheme collection found in the database' });
    }

    const schemes = await schemeCollection.find({}).toArray();
    return res.json({
      schemes: schemes.map((scheme) => ({
        id: String(scheme._id),
        name: firstText(scheme.scheme_name, scheme.schemeName, scheme.name) || 'Unknown Scheme',
        description: firstText(scheme.objective, scheme.description, scheme.overview, scheme.benefits),
        benefits: firstText(scheme.benefits),
        category: firstText(scheme.category, scheme.scheme_category, scheme.scheme_type),
        ministry: firstText(scheme.ministry, scheme.implementing_agency),
        sourceUrl: firstText(scheme.source_url, scheme.url, scheme.schemeUrl, scheme.scheme_url),
      })),
    });
  } catch (error) {
    console.error('Unable to load schemes:', error);
    return res.status(500).json({ message: 'Unable to load schemes from the database' });
  }
});

app.get('/api/recommend/:userId', async (req, res) => {

  const { userId } = req.params;

 

  try {

    if (!userId) {

      return res.status(400).json({ message: 'User ID is required' });

    }

 

    const db = await connectMongo();

 

    const userCollection = await getUserCollection(db);

    if (!userCollection) return res.status(404).json({ message: 'No user collection found in the database' });

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });

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

 

    const recommendations = eligibleSchemes

      .map((scheme) => {

        const finalRecommendation = buildRecommendationRecord(

          normalizedUser,

          scheme,

          scheme.ruleEvaluation

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

app.get('/api/recommend/:userId/tfidf', async (req, res) => {
  const { userId } = req.params;
  const topK = Math.min(Math.max(toNumber(req.query.topK, 10), 1), 50);

  try {
    const db = await connectMongo();
    const userCollection = await getUserCollection(db);
    const schemeCollection = await getSchemeCollection(db);
    if (!userCollection || !schemeCollection) {
      return res.status(404).json({ message: 'Required Users or Schemes collection was not found' });
    }

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const schemes = await schemeCollection.find({}).toArray();
    const result = getTfIdfRecommendations(normalizeUser(user), schemes, topK);

    return res.json({
      user: { name: normalizeUser(user).name || 'User' },
      recommendedSchemes: result.recommendations,
      statistics: {
        users: await userCollection.countDocuments(),
        schemes: schemes.length,
        userSchemeComparisons: schemes.length,
        ...result.statistics,
      },
    });
  } catch (error) {
    console.error('TF-IDF recommendation pipeline error:', error);
    return res.status(500).json({ message: 'Unable to generate TF-IDF recommendations', error: error.message });
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
