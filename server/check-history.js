const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

async function checkHistory() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const DataSyncConfig = mongoose.model('DataSyncConfig', new mongoose.Schema({}, { strict: false }), 'datasyncconfigs');
    
    const configs = await DataSyncConfig.find({});
    console.log(`\n📊 Total de configurações: ${configs.length}`);
    
    configs.forEach((config, idx) => {
      console.log(`\n${idx + 1}. Config: ${config.name}`);
      console.log(`   Histórico: ${config.history ? config.history.length : 0} execuções`);
      if (config.history && config.history.length > 0) {
        config.history.forEach((h, i) => {
          console.log(`   ${i + 1}. ${h.status} - ${new Date(h.startedAt).toLocaleString('pt-BR')} (${h.inserted} inseridos, ${h.updated} atualizados)`);
        });
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkHistory();
