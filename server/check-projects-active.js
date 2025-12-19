const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

async function checkProjects() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
    
    const allProjects = await Project.find({});
    console.log(`\n📊 Total de projetos: ${allProjects.length}`);
    
    const activeProjects = await Project.find({ active: true });
    console.log(`✅ Projetos ativos: ${activeProjects.length}`);
    
    const inactiveProjects = await Project.find({ active: false });
    console.log(`❌ Projetos inativos: ${inactiveProjects.length}`);
    
    const undefinedActive = await Project.find({ active: { $exists: false } });
    console.log(`⚠️  Projetos sem campo active: ${undefinedActive.length}`);
    
    const nullActive = await Project.find({ active: null });
    console.log(`⚠️  Projetos com active null: ${nullActive.length}`);
    
    if (undefinedActive.length > 0 || nullActive.length > 0) {
      console.log('\n🔧 Corrigindo projetos sem active...');
      await Project.updateMany(
        { $or: [{ active: { $exists: false } }, { active: null }] },
        { $set: { active: true } }
      );
      console.log('✅ Projetos corrigidos!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkProjects();
