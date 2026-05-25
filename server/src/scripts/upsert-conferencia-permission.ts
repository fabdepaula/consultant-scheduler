/**
 * Insere/atualiza a permissão do Power BI e opcionalmente associa a perfis.
 * Não apaga dados. Uso: cd server && npx tsx src/scripts/upsert-conferencia-permission.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import { connectDatabase } from '../config/database.js';

dotenv.config();

const PERMISSION = {
  key: 'reports.conferencia-apontamento.view',
  name: 'Conferência de Apontamento',
  resource: 'reports',
  action: 'view',
  category: 'Relatórios',
  description: 'Permite visualizar o relatório Power BI de conferência de apontamentos',
  active: true,
};

const ROLE_KEYS_TO_ATTACH = ['admin', 'usuario', 'gerente'];

async function main() {
  await connectDatabase();

  const perm = await Permission.findOneAndUpdate(
    { key: PERMISSION.key },
    { $set: PERMISSION },
    { upsert: true, new: true }
  );

  console.log(`✅ Permissão: ${perm.key} (_id: ${perm._id})`);

  for (const roleKey of ROLE_KEYS_TO_ATTACH) {
    const role = await Role.findOne({ key: roleKey });
    if (!role) {
      console.log(`⚠️  Perfil "${roleKey}" não encontrado — ignorado`);
      continue;
    }

    const ids = role.permissions.map((id) => id.toString());
    if (ids.includes(perm._id.toString())) {
      console.log(`   Perfil "${roleKey}": já possui a permissão`);
      continue;
    }

    role.permissions.push(perm._id);
    await role.save();
    console.log(`   Perfil "${roleKey}": permissão adicionada`);
  }

  console.log('\nConcluído. Peça aos usuários para sair e entrar novamente (ou recarregar a página).');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
