import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo() {
  const uri: string = process.env.MONGO_URI!;
const dbName: string = process.env.MONGO_DB!;

  if (!uri || !dbName) {
    throw new Error("Missing MONGO_URI or MONGO_DB in .env");
  }

  if (client && db) {
    return { client, db };
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  return { client, db };
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected yet");
  }
  return db;
}
