import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

let mongoClient;
let db;

export async function connectMongo() {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(process.env.MONGODB_DB);
    console.log('✅ Connected to MongoDB');
}

export { db };
