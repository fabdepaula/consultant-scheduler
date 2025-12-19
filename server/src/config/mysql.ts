import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuração da conexão MySQL externa
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'ngrglobal.db.artia.com',
  database: process.env.MYSQL_DATABASE || 'artia',
  user: process.env.MYSQL_USER || 'cliente-ngrglobal',
  password: process.env.MYSQL_PASSWORD || 'b4j5WDsUgjgdKTyK',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Pool de conexões para melhor performance
let pool: mysql.Pool | null = null;

export const getMySQLConnection = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool(mysqlConfig);
    console.log('✅ MySQL connection pool created');
  }
  return pool;
};

export const testMySQLConnection = async (): Promise<boolean> => {
  try {
    const connection = await getMySQLConnection().getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL connection test successful');
    return true;
  } catch (error) {
    console.error('❌ MySQL connection test failed:', error);
    return false;
  }
};

export const closeMySQLConnection = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ MySQL connection pool closed');
  }
};

export default getMySQLConnection;

