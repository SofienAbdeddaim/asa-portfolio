#!/usr/bin/env node
// Empties the end-to-end database. It refuses to touch any database whose name does not end in
// `_e2e`, so it can never wipe real data by pointing at the wrong connection string.
import { MongoClient } from 'mongodb';

const uri = process.env['MONGODB_URI'];
if (!uri) throw new Error('MONGODB_URI is not set');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const name = client.options.dbName ?? '';
  if (!name.endsWith('_e2e')) {
    throw new Error(`Refusing to reset "${name}": the database name must end with _e2e`);
  }
  await client.db(name).dropDatabase();
  console.log(`Reset database ${name}`);
} finally {
  await client.close();
}
