import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'karnataka_schemes_enhance';

let client;
let db;

export async function connectMongo() {
  if (!client) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  if (!db) {
    await client.connect();
    db = client.db(dbName);
  }

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('MongoDB has not been initialized. Call connectMongo() first.');
  }

  return db;
}

export { ObjectId };