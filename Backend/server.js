import express from 'express';

import crypto from 'crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { connectMongo, ObjectId } from './config/db.js';
import { verifyBearerToken } from './services/authToken.js';

import { rankRecommendationCandidates } from './services/recommendationPipeline.js';
import { getTfIdfRecommendations } from './TF_IDF/tfidfRecommendation.js';

 

dotenv.config();

 

const app = express();

const PORT = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET;
const encryptionKey = process.env.ENCRYPTION_KEY;
const chatbotScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'chatbot',
  'chatbot.py',
);

const recommendationSchemeProjection = {
  _id: 1,
  scheme_name: 1,
  schemeName: 1,
  name: 1,
  age_min: 1,
  age_max: 1,
  gender: 1,
  income_limit: 1,
  caste_category: 1,
  caste_restriction: 1,
  applicant_type: 1,
  occupation: 1,
  education: 1,
  district: 1,
  ration_card_type: 1,
  minority_community_required: 1,
  disability_required: 1,
  special_conditions: 1,
  description: 1,
  eligibility: 1,
  benefits: 1,
  objective: 1,
  implementing_agency: 1,
  categories: 1,
  source_url: 1,
  url: 1,
  schemeUrl: 1,
  translations: 1,
};

const schemeCatalogProjection = {
  _id: 1,
  scheme_name: 1,
  schemeName: 1,
  name: 1,
  title: 1,
  objective: 1,
  description: 1,
  overview: 1,
  benefits: 1,
  eligibility: 1,
  eligibility_criteria: 1,
  documents_required: 1,
  required_documents: 1,
  documents: 1,
  application_process: 1,
  how_to_apply: 1,
  process: 1,
  category: 1,
  categories: 1,
  scheme_category: 1,
  scheme_type: 1,
  ministry: 1,
  implementing_agency: 1,
  source_url: 1,
  scheme_url: 1,
  schemeUrl: 1,
  url: 1,
  translations: 1,
};

const chatRateLimitBuckets = new Map();
let chatRateLimitRequests = 0;

function limitChatRequests(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  let bucket = chatRateLimitBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    bucket = { startedAt: now, count: 0 };
    chatRateLimitBuckets.set(key, bucket);
  }
  bucket.count += 1;
  chatRateLimitRequests += 1;
  if (chatRateLimitRequests % 256 === 0) {
    for (const [client, entry] of chatRateLimitBuckets) {
      if (now - entry.startedAt >= 60_000) chatRateLimitBuckets.delete(client);
    }
  }
  if (bucket.count > 10) {
    res.setHeader('Retry-After', String(Math.ceil((60_000 - (now - bucket.startedAt)) / 1000)));
    return res.status(429).json({ message: 'Too many chat requests. Please try again later.' });
  }
  return next();
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in Backend/.env');
}
if (!encryptionKey || encryptionKey.length < 32) {
  throw new Error('ENCRYPTION_KEY must be configured with at least 32 characters in Backend/.env');
}

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
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const parts = payload.split(':');
  let decipher;
  let decrypted;

  if (parts.length === 4 && parts[0] === 'v2') {
    const [, ivPart, tagPart, encryptedData] = parts;
    decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
    decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
  } else if (parts.length === 2 && parts.every(Boolean)) {
    const [ivPart, encryptedData] = parts;
    decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivPart, 'base64'));
    decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
  } else {
    return null;
  }

  const profile = JSON.parse(decrypted);
  return profile && typeof profile === 'object' ? profile : null;
}

function requireUserToken(req, res, next) {
  const payload = verifyBearerToken(req.headers.authorization, jwtSecret);
  if (!payload) return res.status(401).json({ message: 'Valid bearer token is required' });
  req.authUserId = payload.userId;
  return next();
}

function requireOwnUserId(req, res, next) {
  const { userId } = req.params;
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(req.authUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  if (!new ObjectId(userId).equals(new ObjectId(req.authUserId))) {
    return res.status(403).json({ message: 'You may only request recommendations for your own account' });
  }
  return next();
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

  const conditions = source.conditions ?? source.specialConditions;

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

 

function buildRecommendationRecord(scheme, ruleEvaluation, ranking, decisionTreeScore) {

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
  const missingInformation = ruleEvaluation.needsMoreInformation;
  const recommendationReason = ruleEvaluation.status === 'needs_more_information'
    ? `Why more information is needed? Please provide: ${missingInformation.join(', ')}.`
    : `Why are you eligible? ${matchedExplanations.join('; ') || 'Your recorded profile matches the scheme fields.'}`;
  const explanation = [`What is this scheme? ${purpose}`, recommendationReason];

 

  return {

    schemeName: scheme.scheme_name || scheme.schemeName || scheme.name || 'Unknown Scheme',

    sourceUrl: scheme.source_url || scheme.url || scheme.schemeUrl || '',
    description: purpose || '',
    translations: { kn: scheme.translations?.kn || {} },
    ruleScore: Number(ruleEvaluation.ruleScore || 0),
    eligibilityStatus: ruleEvaluation.status,
    needsMoreInformation: missingInformation,
    decisionTreeScore,
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

app.post('/api/chat', limitChatRequests, async (req, res) => {
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

    const schemeRecords = await schemeCollection.find({}, { projection: schemeCatalogProjection }).toArray();
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

    const schemes = await schemeCollection.find({}, { projection: schemeCatalogProjection }).toArray();
    return res.json({
      schemes: schemes.map((scheme) => ({
        id: String(scheme._id),
        name: firstText(scheme.scheme_name, scheme.schemeName, scheme.name) || 'Unknown Scheme',
        description: firstText(scheme.objective, scheme.description, scheme.overview, scheme.benefits),
        benefits: firstText(scheme.benefits),
        eligibility: firstText(scheme.eligibility, scheme.eligibility_criteria),
        documents: firstText(scheme.documents_required, scheme.required_documents, scheme.documents),
        applicationProcess: firstText(scheme.application_process, scheme.how_to_apply, scheme.process),
        category: firstText(scheme.category, scheme.scheme_category, scheme.scheme_type),
        ministry: firstText(scheme.ministry, scheme.implementing_agency),
        sourceUrl: firstText(scheme.source_url, scheme.url, scheme.schemeUrl, scheme.scheme_url),
        translations: { kn: scheme.translations?.kn || {} },
      })),
    });
  } catch (error) {
    console.error('Unable to load schemes:', error);
    return res.status(500).json({ message: 'Unable to load schemes from the database' });
  }
});

app.get('/api/recommend/:userId', requireUserToken, requireOwnUserId, async (req, res) => {

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

 

    const schemes = await schemeCollection.find({}, { projection: recommendationSchemeProjection }).toArray();

    console.log("==================================");

    console.log("Total schemes:", schemes.length);

    console.log("First scheme:", schemes[0]?.scheme_name);

    console.log("==================================");

    const normalizedUser = normalizeUser(user);

    const rankedCandidates = await rankRecommendationCandidates(normalizedUser, schemes);
    console.log("Eligible or information-needed schemes:", rankedCandidates.length);

    if (!rankedCandidates.length) {
      return res.json({
        user: { name: normalizedUser.name || normalizedUser.username || 'User' },
        recommendedSchemes: [],

      });

    }

 

    const recommendations = rankedCandidates
      .map(({ scheme, ruleEvaluation, ranking, decisionTreeScore }) => buildRecommendationRecord(
        scheme,
        ruleEvaluation,
        ranking,
        decisionTreeScore,
      ))
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

app.get('/api/recommend/:userId/tfidf', requireUserToken, requireOwnUserId, async (req, res) => {
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

    const schemes = await schemeCollection.find({}, { projection: recommendationSchemeProjection }).toArray();
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
