declare global {
  // ...existing code commented out...
}
// MongoDB temporarily disabled for deployment
// import { MongoClient } from 'mongodb';
// const uri = process.env.MONGODB_URI!;
// const options = {};
// declare global {
//   var _mongoClientPromise: Promise<MongoClient> | undefined;
// }
// let client: MongoClient;
// let clientPromise: Promise<MongoClient>;
// if (!process.env.MONGODB_URI) {
//   throw new Error('Please add your MongoDB URI to .env.local');
// }
// if (process.env.NODE_ENV === 'development') {
//   if (!global._mongoClientPromise) {
//     client = new MongoClient(uri, options);
//     global._mongoClientPromise = client.connect();
//   }
//   clientPromise = global._mongoClientPromise!;
// } else {
//   client = new MongoClient(uri, options);
//   clientPromise = client.connect();
// }
// const typedClientPromise: Promise<MongoClient> = clientPromise;
// export default typedClientPromise;


