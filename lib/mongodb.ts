import { MongoClient, type MongoClientOptions } from "mongodb";

// Extend the Node global type so TypeScript knows about our cached promise.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options: MongoClientOptions = {};

// Lazy-initialised connection. We DON'T throw at module-load time anymore,
// because Next.js may evaluate this module during build (when env vars aren't
// always available). Any actual DB call will throw with a clear message.
function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(
      new Error(
        "Missing environment variable MONGODB_URI. Set it locally in .env.local and on Vercel under Project Settings -> Environment Variables."
      )
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  // In production each lambda gets its own client. We cache it on globalThis
  // so repeated route handler invocations within the same lambda reuse it.
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

// Export a thenable so existing `await clientPromise` callsites keep working.
const clientPromise: Promise<MongoClient> = {
  then: (...args: Parameters<Promise<MongoClient>["then"]>) =>
    getClientPromise().then(...args),
  catch: (...args: Parameters<Promise<MongoClient>["catch"]>) =>
    getClientPromise().catch(...args),
  finally: (...args: Parameters<Promise<MongoClient>["finally"]>) =>
    getClientPromise().finally(...args),
  [Symbol.toStringTag]: "Promise",
} as Promise<MongoClient>;

export default clientPromise;
