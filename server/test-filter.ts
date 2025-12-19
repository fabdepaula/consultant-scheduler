import { getMySQLConnection } from './src/config/mysql.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testFilter() {
  try {
    const connection = getMySQLConnection();
    const view = 'organization_13952_projects';
    const filter = "created_at >= '2025-01-01'";
    
    // Query sem filtro
    const [rowsNoFilter] = await connection.query(`SELECT * FROM \`${view}\``);
    console.log(`\n📊 Sem filtro: ${Array.isArray(rowsNoFilter) ? rowsNoFilter.length : 0} registros`);
    
    // Query com filtro
    const queryWithFilter = `SELECT * FROM \`${view}\` WHERE ${filter}`;
    console.log(`\n🔍 Query com filtro: ${queryWithFilter}`);
    
    const [rowsWithFilter] = await connection.query(queryWithFilter);
    console.log(`📊 Com filtro: ${Array.isArray(rowsWithFilter) ? rowsWithFilter.length : 0} registros`);
    
    // Testar com o filtro que o usuário está usando
    const userFilter = "created_at >= 01/01/2025";
    const queryUserFilter = `SELECT * FROM \`${view}\` WHERE ${userFilter}`;
    console.log(`\n🔍 Query com filtro do usuário: ${queryUserFilter}`);
    
    try {
      const [rowsUserFilter] = await connection.query(queryUserFilter);
      console.log(`📊 Com filtro do usuário: ${Array.isArray(rowsUserFilter) ? rowsUserFilter.length : 0} registros`);
    } catch (err: any) {
      console.error(`❌ Erro com filtro do usuário: ${err.message}`);
      console.error(`   Código: ${err.code}`);
      console.error(`   SQL Message: ${err.sqlMessage}`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testFilter();
