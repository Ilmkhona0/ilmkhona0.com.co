import { MongoClient, type MongoClientOptions } from "mongodb";

// Extend the Node global type so TypeScript knows about our cached promise.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {};

if (!uri) {
  throw new Error(
    "Missing environment variable MONGODB_URI. Set it locally in .env.local and on Vercel under Project Settings -> Environment Variables."
  );
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development, reuse the connection across HMR reloads.
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production each lambda gets its own client.
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
