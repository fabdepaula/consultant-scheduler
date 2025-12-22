import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

async function checkIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    // Listar todas as coleções
    const collections = await db.listCollections().toArray();
    
    for (const coll of collections) {
      console.log(`\n📋 Collection: ${coll.name}`);
      const indexes = await db.collection(coll.name).indexes();
      indexes.forEach((idx: any) => {
        console.log(`   Index: ${idx.name}`);
        console.log(`   Keys: ${JSON.stringify(idx.key)}`);
        if (idx.unique) console.log(`   ⚠️  UNIQUE: true`);
        console.log('');
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIndexes();
