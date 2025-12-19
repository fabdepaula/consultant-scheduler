import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

async function checkAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const admin = await User.findOne({ email: 'admin@ngrglobal.com.br' });
    
    if (!admin) {
      console.log('❌ Admin não encontrado!');
      process.exit(1);
    }

    console.log('\n👤 Admin encontrado:');
    console.log('   ID:', admin._id);
    console.log('   Nome:', admin.name);
    console.log('   Email:', admin.email);
    console.log('   Profile:', admin.profile);
    console.log('   Functions:', admin.functions);
    console.log('   Active:', admin.active);
    console.log('   Must Change Password:', admin.mustChangePassword);
    console.log('   Password Hash:', admin.password.substring(0, 20) + '...');

    // Testar a senha
    const testPassword = 'Ngr@123';
    const isMatch = await bcrypt.compare(testPassword, admin.password);
    console.log('\n🔐 Teste de senha "Ngr@123":', isMatch ? '✅ CORRETA' : '❌ INCORRETA');

    // Contar usuários
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });
    const admins = await User.countDocuments({ profile: 'admin' });
    
    console.log('\n📊 Estatísticas:');
    console.log('   Total de usuários:', totalUsers);
    console.log('   Usuários ativos:', activeUsers);
    console.log('   Administradores:', admins);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkAdmin();

