import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const encryptionKey = process.env.ENCRYPTION_KEY;
const dbName = process.env.DB_NAME || 'karnataka_schemes_enhance';

if (!mongoUri) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('JWT_SECRET must be configured with at least 32 characters');
  process.exit(1);
}
if (!encryptionKey || encryptionKey.length < 32) {
  console.error('ENCRYPTION_KEY must be configured with at least 32 characters');
  process.exit(1);
}

const client = new MongoClient(mongoUri);

const createCipherKey = () => crypto.createHash('sha256').update(String(encryptionKey)).digest();

const encryptProfile = (profile) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', createCipherKey(), iv);
  let encrypted = cipher.update(JSON.stringify(profile), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `v2:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted}`;
};

const decryptProfile = (payload) => {
  if (!payload) return null;
  const parts = payload.split(':');
  let decipher;
  let decrypted;

  if (parts.length === 4 && parts[0] === 'v2') {
    const [, ivPart, tagPart, encryptedData] = parts;
    decipher = crypto.createDecipheriv('aes-256-gcm', createCipherKey(), Buffer.from(ivPart, 'base64'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
    decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
  } else if (parts.length === 2 && parts.every(Boolean)) {
    const [ivPart, encryptedData] = parts;
    decipher = crypto.createDecipheriv('aes-256-cbc', createCipherKey(), Buffer.from(ivPart, 'base64'));
    decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
  } else {
    return null;
  }

  return JSON.parse(decrypted);
};

const profileFields = [
  'name',
  'mobile',
  'verified',
  'dob',
  'gender',
  'income',
  'rationCard',
  'caste',
  'minorityType',
  'occupation',
  'conditions',
  'location',
];
const profileFieldSet = new Set(profileFields);
const locationFields = ['state', 'district', 'taluk', 'village', 'pincode'];
const conditionValues = new Set(['pregnant', 'widow', 'disabled']);

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  if (Object.keys(profile).some((key) => !profileFieldSet.has(key))) return null;
  if (typeof profile.name !== 'string'
    || typeof profile.mobile !== 'string'
    || typeof profile.verified !== 'boolean'
    || typeof profile.dob !== 'string'
    || !['male', 'female', 'other'].includes(profile.gender)
    || !Number.isFinite(profile.income)
    || !['APL', 'BPL', 'AAY', 'None'].includes(profile.rationCard)
    || typeof profile.caste !== 'string'
    || typeof profile.occupation !== 'string'
    || !Array.isArray(profile.conditions)
    || profile.conditions.some((condition) => typeof condition !== 'string' || !conditionValues.has(condition))
    || !profile.location
    || typeof profile.location !== 'object'
    || Array.isArray(profile.location)
    || Object.keys(profile.location).some((key) => !locationFields.includes(key))
    || locationFields.some((key) => typeof profile.location[key] !== 'string')) {
    return null;
  }
  if (profile.minorityType !== undefined && typeof profile.minorityType !== 'string') return null;

  return Object.fromEntries(profileFields
    .filter((key) => Object.hasOwn(profile, key))
    .map((key) => [key, key === 'location'
      ? Object.fromEntries(locationFields.map((field) => [field, profile.location[field]]))
      : profile[key]]));
}

const rateLimitBuckets = new Map();
let rateLimitRequests = 0;

function rateLimit({ windowMs, maxRequests }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.path}:${req.ip}`;
    let bucket = rateLimitBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      rateLimitBuckets.set(key, bucket);
    }

    bucket.count += 1;
    rateLimitRequests += 1;
    if (rateLimitRequests % 256 === 0) {
      for (const [bucketKey, entry] of rateLimitBuckets) {
        if (now - entry.startedAt >= windowMs) rateLimitBuckets.delete(bucketKey);
      }
    }
    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    return next();
  };
}

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 });
const chatbotRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 10 });

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = payload.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const formatUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  phone: user.phone || null,
  hasProfile: user.hasProfile,
  profile: user.profile ? decryptProfile(user.profile) : null,
});

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    console.log('Incoming Origin:',origin);
    console.log('Allowed Origins:',allowedOrigins);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
}));
app.use(express.json({ limit: '16kb' }));

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  const { phone, username, password } = req.body;
  if (typeof phone !== 'string' || typeof username !== 'string' || typeof password !== 'string'
    || !phone.trim() || !username.trim() || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Phone, username and password are required' });
  }

  try {
    const db = client.db(dbName);
    const users = db.collection('users');

    const existing = await users.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      username,
      phone,
      passwordHash,
      hasProfile: false,
      profile: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Unable to complete registration' });
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const db = client.db(dbName);
    const users = db.collection('users');
    const user = await users.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.profile && !user.profile.startsWith('v2:')) {
      const oldProfile = decryptProfile(user.profile);
      if (oldProfile) {
        user.profile = encryptProfile(oldProfile);
        await users.updateOne(
          { _id: user._id },
          {
            $set: { profile: user.profile, updatedAt: new Date() },
            $unset: Object.fromEntries(profileFields.map((field) => [field, ''])),
          },
        );
      }
    }

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '7d' });
    return res.json({ token, user: formatUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Unable to sign in' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const db = client.db(dbName);
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user: formatUser(user) });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ message: 'Unable to fetch user' });
  }
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const profileData = validateProfile(req.body);
  if (!profileData) {
    return res.status(400).json({ message: 'Profile fields are invalid or contain unsupported properties' });
  }

  try {
    const db = client.db(dbName);
    const users = db.collection('users');
    const profile = encryptProfile(profileData);

    await users.updateOne(
      { _id: new ObjectId(req.userId) },
      {
        $set: {
          profile,
          hasProfile: true,
          updatedAt: new Date(),
        },
        $unset: Object.fromEntries(profileFields.map((field) => [field, ''])),
      }
    );

    const user = await users.findOne({ _id: new ObjectId(req.userId) });
    return res.json({ user: formatUser(user) });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ message: 'Unable to save profile' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to MongoDB:', error);
    process.exit(1);
  }
};

startServer();
