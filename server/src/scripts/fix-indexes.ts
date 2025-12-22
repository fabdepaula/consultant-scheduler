import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

async function fixIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    // Remover índice único problemático
    try {
      await db.collection('allocations').dropIndex('consultantId_1_date_1_timeSlot_1');
      console.log('✅ Removed unique index: consultantId_1_date_1_timeSlot_1');
    } catch (e: any) {
      console.log('Index does not exist or already removed:', e.message);
    }

    // Recriar como índice NÃO único (para performance de busca)
    await db.collection('allocations').createIndex(
      { consultantId: 1, date: 1, timeSlot: 1 },
      { unique: false }
    );
    console.log('✅ Created non-unique index: consultantId_1_date_1_timeSlot_1');

    await mongoose.disconnect();
    console.log('\n✅ Done! Now you can create multiple allocations in the same slot.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndexes();
