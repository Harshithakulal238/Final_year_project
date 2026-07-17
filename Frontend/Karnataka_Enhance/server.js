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
const jwtSecret = process.env.JWT_SECRET || 'change_this_secret';
const encryptionKey = process.env.ENCRYPTION_KEY || 'change_this_to_a_32_byte_key';
const dbName = process.env.DB_NAME || 'karnataka_schemes';

if (!mongoUri) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}

const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createCipherKey = () => crypto.createHash('sha256').update(String(encryptionKey)).digest();

const encryptProfile = (profile) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', createCipherKey(), iv);
  let encrypted = cipher.update(JSON.stringify(profile), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
};

const decryptProfile = (payload) => {
  if (!payload) return null;
  const [ivPart, encryptedData] = payload.split(':');
  if (!ivPart || !encryptedData) return null;
  const iv = Buffer.from(ivPart, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', createCipherKey(), iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

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
  hasProfile: user.hasProfile,
  profile: user.profile ? decryptProfile(user.profile) : null,
});

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  const { phone, username, password } = req.body;
  if (!phone || !username || !password) {
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
    await users.insertOne({ username, passwordHash, hasProfile: false, profile: null, createdAt: new Date() });

    return res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Unable to complete registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
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
  const profileData = req.body;
  if (!profileData || typeof profileData !== 'object') {
    return res.status(400).json({ message: 'Profile data is required' });
  }

  try {
    const db = client.db(dbName);
    const users = db.collection('users');
    const profile = encryptProfile(profileData);
    await users.updateOne({ _id: new ObjectId(req.userId) }, { $set: { profile, hasProfile: true } });
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
