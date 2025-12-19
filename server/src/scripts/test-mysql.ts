import { testMySQLConnection, getMySQLConnection } from '../config/mysql.js';

async function testMySQL() {
  console.log('🔍 Testando conexão MySQL...\n');

  // Teste 1: Conexão básica
  console.log('1️⃣ Testando conexão básica...');
  const connectionTest = await testMySQLConnection();
  
  if (!connectionTest) {
    console.error('❌ Falha na conexão. Verifique as credenciais e a conectividade de rede.');
    process.exit(1);
  }

  // Teste 2: Listar views disponíveis
  console.log('\n2️⃣ Listando views disponíveis...');
  try {
    const connection = getMySQLConnection();
    const [views] = await connection.execute(
      `SELECT TABLE_NAME as view_name
       FROM information_schema.VIEWS 
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME
       LIMIT 10`
    );
    
    console.log(`✅ Encontradas ${(views as any[]).length} views:`);
    (views as any[]).forEach((view: any) => {
      console.log(`   - ${view.view_name}`);
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar views:', error.message);
  }

  // Teste 3: Testar uma view (se existir)
  console.log('\n3️⃣ Testando acesso a uma view...');
  try {
    const connection = getMySQLConnection();
    const [views] = await connection.execute(
      `SELECT TABLE_NAME as view_name
       FROM information_schema.VIEWS 
       WHERE TABLE_SCHEMA = DATABASE()
       LIMIT 1`
    );
    
    if ((views as any[]).length > 0) {
      const viewName = (views as any[])[0].view_name;
      console.log(`   Testando view: ${viewName}`);
      
      const [rows] = await connection.execute(
        `SELECT * FROM \`${viewName}\` LIMIT 5`
      );
      
      console.log(`   ✅ View acessível! Retornou ${(rows as any[]).length} registros (limitado a 5)`);
      
      if ((rows as any[]).length > 0) {
        console.log(`   📋 Exemplo de colunas: ${Object.keys((rows as any[])[0]).join(', ')}`);
      }
    } else {
      console.log('   ⚠️ Nenhuma view encontrada no banco de dados');
    }
  } catch (error: any) {
    console.error('❌ Erro ao testar view:', error.message);
  }

  console.log('\n✅ Teste concluído!');
  process.exit(0);
}

testMySQL().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

