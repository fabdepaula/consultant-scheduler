import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDatabase } from './config/database.js';
import { testMySQLConnection } from './config/mysql.js';
import './config/passport.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSyncScheduler } from './jobs/syncScheduler.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: process.env.CLIENT_URL || true, // Permite mesmo domínio
    credentials: true,
  }));
} else {
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta uploads
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

// Servir frontend estático em produção
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(process.cwd(), 'client', 'dist');
  
  if (fs.existsSync(clientDistPath)) {
    // Servir arquivos estáticos com base /agenda
    app.use('/agenda', express.static(clientDistPath));
    
    // Rota /agenda serve o index.html
    app.get('/agenda', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
    
    // Rotas SPA dentro de /agenda (para React Router)
    app.get('/agenda/*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Rota não encontrada' });
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    console.warn('⚠️ Frontend build not found, serving API only');
    app.use((req, res) => {
      res.status(404).json({ message: 'Rota não encontrada' });
    });
  }
} else {
  // 404 handler para desenvolvimento
  app.use((req, res) => {
    res.status(404).json({ message: 'Rota não encontrada' });
  });
}

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    
    // Testa conexão MySQL (não bloqueia o servidor se falhar)
    testMySQLConnection().catch((error) => {
      console.warn('⚠️ MySQL connection test failed (server will continue):', error.message);
    });
    
    // Inicia agendamentos de integrações
    initSyncScheduler().catch((err) => {
      console.warn('⚠️ Scheduler init failed:', err);
    });
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📚 API available at http://0.0.0.0:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();


