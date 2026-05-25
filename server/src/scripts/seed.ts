import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Allocation from '../models/Allocation.js';
import StatusConfig from '../models/StatusConfig.js';
import FunctionConfig from '../models/FunctionConfig.js';
import Team from '../models/Team.js';
import DataSyncConfig from '../models/DataSyncConfig.js';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consultant-scheduler';

// Teams - devem ser criados primeiro para referenciar nos usuários
const teams = [
  { name: 'Projeto', active: true },
  { name: 'Suporte', active: true },
  { name: 'Legal/HighQ', active: true },
  { name: 'Gerente', active: true },
];

// Configuração das funções
const functionConfigs = [
  { key: 'import', label: 'Import' },
  { key: 'export', label: 'Export' },
  { key: 'cambio', label: 'Câmbio' },
  { key: 'drawback', label: 'Drawback' },
  { key: 'recof', label: 'Recof' },
  { key: 'gerente', label: 'Gerente' },
  { key: 'integração', label: 'Integração' },
  { key: 'suporte', label: 'Suporte' },
];

// Configuração dos status
const statusConfigs = [
  { key: 'confirmado_presencial', label: 'Confirmado Presencial', color: '#FFFF00', textColor: '#000000', order: 1, requiresProject: true, showInContextMenu: true },
  { key: 'confirmado_remoto', label: 'Confirmado Remoto', color: '#ffffff', textColor: '#000000', order: 2, requiresProject: true, showInContextMenu: true },
  { key: 'a_confirmar', label: 'À Confirmar', color: '#4472C4', textColor: '#FFFFFF', order: 3, requiresProject: true, showInContextMenu: true },
  { key: 'livre', label: 'Livre', color: '#a9e5b5', textColor: '#000000', order: 4, requiresProject: false, showInContextMenu: true },
  { key: 'bloqueado', label: 'Bloqueado', color: '#A6A6A6', textColor: '#FFFFFF', order: 5, requiresProject: false, showInContextMenu: false },
  { key: 'conflito', label: 'Conflito', color: '#FF0000', textColor: '#FFFFFF', order: 6, requiresProject: true, showInContextMenu: false },
  { key: 'ponte', label: 'Ponte', color: '#BFBFBF', textColor: '#000000', order: 7, requiresProject: false, showInContextMenu: false },
  { key: 'feriado', label: 'Feriado', color: '#A6A6A6', textColor: '#FFFFFF', order: 8, requiresProject: false, showInContextMenu: false },
  { key: 'fim_semana', label: 'Final de Semana', color: '#D9D9D9', textColor: '#000000', order: 9, requiresProject: false, showInContextMenu: false },
];

// Permissões do sistema
const permissions = [
  // Agenda
  { key: 'allocations.view', name: 'Visualizar Alocações', resource: 'allocations', action: 'view', category: 'Agenda', description: 'Permite visualizar alocações na agenda' },
  { key: 'allocations.create', name: 'Criar Alocações', resource: 'allocations', action: 'create', category: 'Agenda', description: 'Permite criar novas alocações' },
  { key: 'allocations.update', name: 'Editar Alocações', resource: 'allocations', action: 'update', category: 'Agenda', description: 'Permite editar alocações existentes' },
  { key: 'allocations.delete', name: 'Remover Alocações', resource: 'allocations', action: 'delete', category: 'Agenda', description: 'Permite remover alocações' },
  { key: 'allocations.bulk', name: 'Operações em Massa', resource: 'allocations', action: 'bulk', category: 'Agenda', description: 'Permite criar/editar múltiplas alocações de uma vez' },
  
  // Usuários/Consultores
  { key: 'users.view', name: 'Visualizar Usuários', resource: 'users', action: 'view', category: 'Usuários', description: 'Permite visualizar lista de usuários' },
  { key: 'users.create', name: 'Criar Usuários', resource: 'users', action: 'create', category: 'Usuários', description: 'Permite criar novos usuários' },
  { key: 'users.update', name: 'Editar Usuários', resource: 'users', action: 'update', category: 'Usuários', description: 'Permite editar usuários existentes' },
  { key: 'users.delete', name: 'Remover Usuários', resource: 'users', action: 'delete', category: 'Usuários', description: 'Permite remover usuários' },
  
  // Projetos
  { key: 'projects.view', name: 'Visualizar Projetos', resource: 'projects', action: 'view', category: 'Projetos', description: 'Permite visualizar lista de projetos' },
  { key: 'projects.create', name: 'Criar Projetos', resource: 'projects', action: 'create', category: 'Projetos', description: 'Permite criar novos projetos' },
  { key: 'projects.update', name: 'Editar Projetos', resource: 'projects', action: 'update', category: 'Projetos', description: 'Permite editar projetos existentes' },
  { key: 'projects.delete', name: 'Remover Projetos', resource: 'projects', action: 'delete', category: 'Projetos', description: 'Permite remover projetos' },
  
  // Configurações
  { key: 'functions.manage', name: 'Gerenciar Funções', resource: 'functions', action: 'manage', category: 'Configurações', description: 'Permite gerenciar funções de consultores' },
  { key: 'teams.manage', name: 'Gerenciar Equipes', resource: 'teams', action: 'manage', category: 'Configurações', description: 'Permite gerenciar equipes' },
  { key: 'status.manage', name: 'Gerenciar Status', resource: 'status', action: 'manage', category: 'Configurações', description: 'Permite gerenciar status de alocações' },
  { key: 'roles.manage', name: 'Gerenciar Perfis', resource: 'roles', action: 'manage', category: 'Configurações', description: 'Permite gerenciar perfis e permissões' },
  
  // Dados e Integrações
  { key: 'external-data.view', name: 'Visualizar Dados Externos', resource: 'external-data', action: 'view', category: 'Dados', description: 'Permite visualizar dados externos' },
  
  // Middleware
  { key: 'middleware.view', name: 'Visualizar Middleware', resource: 'middleware', action: 'view', category: 'Middleware', description: 'Permite visualizar interfaces/middleware' },
  { key: 'middleware.create', name: 'Nova Interface', resource: 'middleware', action: 'create', category: 'Middleware', description: 'Permite criar novas interfaces/middleware' },
  { key: 'middleware.update', name: 'Editar Interface', resource: 'middleware', action: 'update', category: 'Middleware', description: 'Permite editar interfaces/middleware existentes' },
  { key: 'middleware.execute', name: 'Executar Interface', resource: 'middleware', action: 'execute', category: 'Middleware', description: 'Permite executar interfaces/middleware' },

  // Relatórios
  { key: 'reports.conferencia-apontamento.view', name: 'Conferência de Apontamento', resource: 'reports', action: 'view', category: 'Relatórios', description: 'Permite visualizar o relatório Power BI de conferência de apontamentos' },
];

// Usuários - todos com senha padrão Ngr@123
// Teams serão associados após criação dos teams
// NOTA: Admin é criado separadamente, não está nesta lista
const users = [
  { name: 'Andre Mariano', email: 'andre.mariano@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Caio Fonseca', email: 'caio.fonseca@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Cleber Zaghi', email: 'cleber.zaghi@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export', 'cambio'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Daiana Amorim', email: 'daiana.amorim@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export', 'drawback'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Ednilson Queiroz de Castro', email: 'ednilson.castro@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Projeto', 'Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Elder Almeida', email: 'elder.almeida@ngrglobal.com.br', profile: 'usuario', functions: ['export', 'import', 'cambio'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Henrique Carvalho', email: 'henrique.carvalho@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Iago Silva', email: 'iago.silva@ngrglobal.com.br', profile: 'usuario', functions: ['suporte'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'José Henrique (Buga)', email: 'jose.henrique@ngrglobal.com.br', profile: 'usuario', functions: ['cambio', 'recof'], teams: ['Suporte'], hasAgenda: true, active: false, mustChangePassword: true },
  { name: 'Leandro Tonini', email: 'leandro.tonini@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Marcos Carneiro', email: 'marcos.carneiro@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Mauro Santanna', email: 'mauro.santanna@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: false, active: false, mustChangePassword: true },
  { name: 'Murilo Pereira', email: 'murilo.pereira@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Rafael Martelli', email: 'rafael.martelli@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Rafael Regolão', email: 'rafael.regolao@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Ricardo Franzolin', email: 'ricardo.franzolin@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Wanderson Alves', email: 'wanderson.alves@ngrglobal.com.br', profile: 'usuario', functions: ['recof', 'drawback'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Elienai Barros', email: 'elienai.barros@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Ewerton Dario', email: 'ewerton.dario@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'cambio'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Isaac Mendes Jr.', email: 'isaac.mendes@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: true, mustChangePassword: true },
  { name: 'Fabiano de Paula', email: 'fabiano.paula@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Julio Portilho', email: 'julio.portilho@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Leonardo Reis', email: 'leonardo.reis@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: false, mustChangePassword: true },
  { name: 'José Henrique (Buga)', email: 'henrique.silva@ngrglobal.com.br', profile: 'usuario', functions: ['cambio', 'recof'], teams: ['Projeto'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Guilherme Afonso', email: 'guilherme.afonso@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Fernando Pechula', email: 'fernando.pechula@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: true, mustChangePassword: true },
  { name: 'Altevir Junior', email: 'altevir.junior@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Otavio Silva', email: 'otavio.silva@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: false, mustChangePassword: true },
  { name: 'Vicente Moura', email: 'vicente.moura@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Vinicius Martins', email: 'vinicius.martins@ngrglobal.com.br', profile: 'usuario', functions: [], teams: ['Legal/HighQ'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Fabiano (teste)', email: 'fabdepaula@gmail.com', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: true, mustChangePassword: true },
  { name: 'Matheus Afonso', email: 'matheus.afonso@ngrglobal.com.br', profile: 'usuario', functions: [], teams: ['Legal/HighQ'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Nilton C. Machado', email: 'nilton.machado@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Thamires Lavagnoli', email: 'thamires.lavagnoli@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: false, mustChangePassword: true },
  { name: 'Airton Angelelli', email: 'airton.angelelli@ngrglobal.com.br', profile: 'usuario', functions: ['gerente'], teams: ['Gerente'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Ingrid Santos', email: 'ingrid.santos@ngrglobal.com.br', profile: 'usuario', functions: [], teams: [], hasAgenda: false, active: true, mustChangePassword: true },
  { name: 'Marcos Rogerio', email: 'marcos.rogerio@ngrglobal.com.br', profile: 'usuario', functions: ['export', 'import'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Mauro Santanna Junior', email: 'mauro.junior@ngrglobal.com.br', profile: 'usuario', functions: ['integração'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
  { name: 'Claudio Simoes', email: 'claudio.simoes@ngrglobal.com.br', profile: 'usuario', functions: [], teams: ['Suporte'], hasAgenda: false, active: true, mustChangePassword: true },
  { name: 'Sidnei Santos', email: 'sidnei.santos@ngrglobal.com.br', profile: 'usuario', functions: ['import', 'export'], teams: ['Suporte'], hasAgenda: true, active: true, mustChangePassword: true },
];

// Projetos
const projects = [
  { projectId: '450', client: 'TE Connectivity', projectType: 'Sustentação', projectName: '450 - TYCO - Sustentação - Consultoria de Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '489', client: 'YAMAHA', projectType: 'Sustentação', projectName: '489 - YAMAHA - Sustentação - Pacote Standard', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '323', client: 'AVERY DENNISON', projectType: 'Sustentação', projectName: '323 - Avery Dennison - Sustentação - Consultoria de Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '740', client: 'MINERVA', projectType: 'Sustentação', projectName: '740 - Minerva - Sustentação - Pacote Advanced', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1171', client: 'ASSAÍ', projectType: 'Sustentação', projectName: '1171 - Assaí - Sustentação - Consultoria de Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1256', client: 'MOURA', projectType: 'Sustentação', projectName: '1256 - Moura - Sustentação Pacote Advanced (24 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1826', client: 'MERCK SHARP', projectType: 'Sustentação', projectName: '1826 - Merck - Sustentação OSGT Pacote Advanced', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1940', client: 'PPG', projectType: 'Sustentação', projectName: '1940 - PPG - Sustentação Pacote Standard (48 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1974', client: 'Odebrecht', projectType: 'Sustentação', projectName: '1974 - Odebrecht - Sustentação Pacote Advanced', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2094', client: 'INDORAMA', projectType: 'Sustentação', projectName: '2094 - Indorama - Sustentação Pacote Advanced (40 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2020', client: 'WEST PHARMA', projectType: 'Implantação/Upgrade', projectName: '2020 - West Pharma - Implantação Recof SPED', projectManager: 'Nilton C. Machado', active: true },
  { projectId: '2180', client: 'Dynapac', projectType: 'Sustentação', projectName: '2180 - DYNAPAC - Sustentação Pacote Advanced 32 Horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2043', client: 'GM', projectType: 'Sustentação', projectName: '2043 - GM - Sustentação Pacote Advanced 336 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2158', client: 'CRISTALIA', projectType: 'Sustentação', projectName: '2158 - Cristália- Sustentação Pacote Advanced', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2511', client: 'COFCO', projectType: 'Sustentação', projectName: '2511 - COFCO - Sustentação Pacote Advanced (80 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2590', client: 'MULTILOG', projectType: 'Sustentação', projectName: '2590 - MULTILOG - Sustentação Pacote Advanced (40 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2441', client: 'EQUIPLEX', projectType: 'Implantação/Upgrade', projectName: '2441 - Equiplex - Implantação IS, CI com INTEGRAÇÃO SAP', projectManager: 'Nilton C. Machado', active: true },
  { projectId: '2693', client: 'SMR Automotive', projectType: 'Implantação/Upgrade', projectName: '2693 - SMR Automotive - Implantação IS com INTEGRAÇÃO SAP PI', projectManager: 'Nilton C. Machado', active: true },
  { projectId: '2999', client: 'CIBRA', projectType: 'Consultoria', projectName: '2999 - Cibra - Cat. Produtos Duimp com IA', projectManager: 'Altevir Junior', active: true },
  { projectId: '3049', client: 'Mondelez', projectType: 'Implantação/Upgrade', projectName: '3049 - Mondelez - Reforma Tributária', projectManager: 'Altevir Junior', active: true },
  { projectId: '3024', client: 'ALLTECH', projectType: 'Implantação/Upgrade', projectName: '3024 - ALLTECH - Implantação IS com Integrador Protheus', projectManager: 'Vicente Moura', active: true },
  { projectId: '3047', client: 'Eletrolux', projectType: 'Implantação/Upgrade', projectName: '3047 - Electrolux - Novo Importador Argentina AR24', projectManager: 'Vicente Moura', active: true },
  { projectId: '3023', client: 'CHILLIBEANS', projectType: 'Sustentação', projectName: '3023 - CHILLIBEANS - Pacote Advanced (40 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '3154', client: 'YAMAHA', projectType: 'Consultoria', projectName: '3154 - Yamaha - Integração OSGT sistema Plano de Exportação IS,ES com WS', projectManager: 'Altevir Junior', active: true },
  { projectId: '2854', client: 'Mondelez', projectType: 'sem preencher no Artia', projectName: '2854 - Mondelez - Bolsão de 425 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '1483', client: 'KAWASAKI', projectType: 'sem preencher no Artia', projectName: '1483 - Kawasaki - Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2875', client: 'CASA DOS VENTOS', projectType: 'sem preencher no Artia', projectName: '2875 - Casa dos Ventos - Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2406', client: 'PRATT & WHITNEY', projectType: 'sem preencher no Artia', projectName: '2406 - Pratt&Whitney - Sustentação', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2404', client: 'MODINE', projectType: 'sem preencher no Artia', projectName: '2404 - MODINE - Sustentação OSGT', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2892', client: 'PUREM', projectType: 'sem preencher no Artia', projectName: '2892 - Purem - Sustentação - Pacote Advanced 60 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2784', client: 'Bausch', projectType: 'sem preencher no Artia', projectName: '2784 - Bausch & Lomb - Sustentação - Pacote Advanced 40 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2502', client: 'NAL', projectType: 'sem preencher no Artia', projectName: '2502 - NAL -  Implantação IS, CI com Webservice', projectManager: 'Altevir Junior', active: true },
  { projectId: '3022', client: 'Berneck', projectType: 'sem preencher no Artia', projectName: '3022 - Berneck - Sustentação Advanced 80 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2949', client: 'QUÍMICA ANASTÁCIO', projectType: 'sem preencher no Artia', projectName: '2949 - Química Anastácio - Sustentação Pacote Advanced 24 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '3079', client: 'NITERRA', projectType: 'sem preencher no Artia', projectName: '3079 - NITERRA - Sustentação Pacote Advanced (40 horas)', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '3083', client: 'HONDA', projectType: 'sem preencher no Artia', projectName: '3083 - HONDA - Sustentação - Pacote Advanced 80 horas', projectManager: 'Guilherme Afonso', active: true },
  { projectId: '2786', client: 'Integra CSC', projectType: 'sem preencher no Artia', projectName: '2786 - Integra CSC - Implantação IS, CI com Integração SAP B1 e G5 via WS', projectManager: 'Nilton C. Machado', active: true },
  { projectId: '3280', client: 'VOGLER', projectType: 'sem preencher no Artia', projectName: '3280 - Vogler - Novo Processo de Importação DUIMP', projectManager: 'Altevir Junior', active: true },
  { projectId: '3198', client: 'WIKA', projectType: 'sem preencher no Artia', projectName: '3198 - Wika - Nova Planta IS, ES, Recof com WS e txt', projectManager: 'Altevir Junior', active: true },
  { projectId: '3140', client: 'VOGLER', projectType: 'sem preencher no Artia', projectName: '3140 - Vogler - Reforma Tributária', projectManager: 'Altevir Junior', active: true },
  { projectId: '3000', client: 'Rehau', projectType: 'sem preencher no Artia', projectName: '3000 - Rehau - Tratamento de Interface Recebimento', projectManager: 'Altevir Junior', active: true },
  { projectId: 'SUST', client: 'Sustentação', projectType: 'Sustentação', projectName: 'Sustentação', projectManager: 'Guilherme Afonso', active: true },
];

// Data Sync Configs
const dataSyncConfigs = [
  {
    name: 'Usuário',
    description: 'Carga de Usuário Ativos no Artia',
    active: true,
    sourceView: 'organization_13952_organization_users',
    targetCollection: 'users' as const,
    targetApi: '/api/users',
    sourceKeyField: 'email',
    targetKeyField: 'email',
    filterClause: 'organization_user_state = "Ativo"',
    mappings: [
      {
        sourceField: 'email',
        targetField: 'email',
        transformations: [],
      },
      {
        sourceField: 'name',
        targetField: 'name',
        transformations: [
          {
            type: 'defaultValue' as const,
            options: {
              defaultValue: '',
              map: [],
            },
          },
        ],
      },
    ],
    schedule: {
      mode: 'none' as const,
    },
    history: [],
  },
  {
    name: 'Projetos',
    description: 'Carga dos Projetos do Artia',
    active: true,
    sourceView: 'organization_13952_projects',
    targetCollection: 'projects' as const,
    targetApi: '/api/projects',
    sourceKeyField: 'project_number',
    targetKeyField: 'projectId',
    filterClause: 'project_status_name = "Em Andamento" AND project_number IS NOT NULL AND customer_name IS NOT NULL',
    mappings: [
      {
        sourceField: 'project_number',
        targetField: 'projectId',
        transformations: [],
      },
      {
        sourceField: 'group_categories',
        targetField: 'projectType',
        transformations: [
          {
            type: 'defaultValue' as const,
            options: {
              defaultValue: 'sem preencher no Artia',
              map: [],
            },
          },
        ],
      },
      {
        sourceField: 'project_name',
        targetField: 'projectName',
        transformations: [],
      },
      {
        sourceField: 'responsible_user_name',
        targetField: 'projectManager',
        transformations: [],
      },
      {
        sourceField: 'customer_name',
        targetField: 'client',
        transformations: [],
      },
    ],
    schedule: {
      mode: 'none' as const,
    },
    history: [],
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    // Clear existing data - SEMPRE limpar antes de criar
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Project.deleteMany({});
    await Allocation.deleteMany({});
    await StatusConfig.deleteMany({});
    await FunctionConfig.deleteMany({});
    await Team.deleteMany({});
    await DataSyncConfig.deleteMany({});
    await Permission.deleteMany({});
    await Role.deleteMany({});
    console.log('✅ All existing data cleared');

    // Create teams first (needed for user references) - usar upsert para evitar duplicação
    const createdTeams = await Promise.all(
      teams.map(team => 
        Team.findOneAndUpdate(
          { name: team.name },
          team,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    const teamMap = new Map(createdTeams.map(t => [t.name, t._id]));
    console.log(`👥 Created/updated ${createdTeams.length} teams`);

    // Create permissions - usar upsert para evitar duplicação
    const createdPermissions = await Promise.all(
      permissions.map(perm =>
        Permission.findOneAndUpdate(
          { key: perm.key },
          perm,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    const permissionMap = new Map(createdPermissions.map(p => [p.key, p._id]));
    console.log(`🔐 Created/updated ${createdPermissions.length} permissions`);

    // Create roles - usar upsert para evitar duplicação
    // Perfil Administrador - todas as permissões, todas as equipes
    const adminRole = await Role.findOneAndUpdate(
      { key: 'admin' },
      {
        name: 'Administrador',
        key: 'admin',
        description: 'Perfil com acesso total ao sistema',
        permissions: Array.from(permissionMap.values()), // Todas as permissões
        allowedTeams: undefined, // undefined = pode ver todas as equipes
        active: true,
        isSystem: true, // Perfil do sistema não pode ser deletado
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Perfil Usuário - apenas visualização de alocações
    const userRole = await Role.findOneAndUpdate(
      { key: 'usuario' },
      {
        name: 'Usuário',
        key: 'usuario',
        description: 'Perfil com acesso limitado - apenas visualização',
        permissions: [
          permissionMap.get('allocations.view'),
        ].filter(Boolean) as any, // Apenas visualizar alocações
        allowedTeams: undefined, // undefined = pode ver todas as equipes (por enquanto)
        active: true,
        isSystem: true, // Perfil do sistema não pode ser deletado
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const roleMap = new Map([
      ['admin', adminRole._id],
      ['usuario', userRole._id],
    ]);
    console.log(`👤 Created/updated 2 system roles (admin, usuario)`);

    // Create status configs - usar upsert para evitar duplicação
    await Promise.all(
      statusConfigs.map(config =>
        StatusConfig.findOneAndUpdate(
          { key: config.key },
          config,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    console.log(`📊 Created/updated ${statusConfigs.length} status configurations`);

    // Create function configs - usar upsert para evitar duplicação
    await Promise.all(
      functionConfigs.map(config =>
        FunctionConfig.findOneAndUpdate(
          { key: config.key },
          config,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    console.log(`🔧 Created/updated ${functionConfigs.length} function configurations`);

    // Create admin user - usar findOne + save para garantir que o hook pre-save seja executado
    let admin = await User.findOne({ email: 'admin@ngrglobal.com.br' });
    if (admin) {
      admin.name = 'Administrador';
      admin.password = 'Ngr@123'; // Será hasheado pelo pre-save hook
      admin.profile = 'admin';
      admin.role = roleMap.get('admin') as any;
      admin.functions = ['gerente'];
      admin.teams = [];
      admin.hasAgenda = false;
      admin.active = true;
      admin.mustChangePassword = false;
      await admin.save(); // Isso dispara o pre-save hook
    } else {
      admin = await User.create({
        name: 'Administrador',
        email: 'admin@ngrglobal.com.br',
        password: 'Ngr@123',
        profile: 'admin',
        role: roleMap.get('admin'),
        functions: ['gerente'],
        teams: [],
        hasAgenda: false,
        active: true,
        mustChangePassword: false,
      });
    }
    console.log('👤 Created/updated admin user: admin@ngrglobal.com.br / Ngr@123');

    // Create users with team references - usar findOne + save para garantir hash da senha
    // Usar Promise.allSettled para continuar mesmo se alguns falharem
    const userResults = await Promise.allSettled(
      users.map(async (u) => {
        try {
          const teamIds = u.teams.map(teamName => teamMap.get(teamName)).filter(Boolean) as mongoose.Types.ObjectId[];
          let user = await User.findOne({ email: u.email });
          const userRoleId = roleMap.get(u.profile);
          if (user) {
            user.name = u.name;
            user.password = 'Ngr@123'; // Será hasheado pelo pre-save hook
            user.profile = u.profile as 'admin' | 'usuario';
            user.role = userRoleId as any;
            user.functions = u.functions as ('gerente' | 'import' | 'export' | 'cambio' | 'drawback' | 'recof' | 'suporte')[];
            user.teams = teamIds;
            user.hasAgenda = u.hasAgenda;
            user.active = u.active;
            user.mustChangePassword = u.mustChangePassword;
            await user.save(); // Isso dispara o pre-save hook
          } else {
            user = await User.create({
              name: u.name,
              email: u.email,
              password: 'Ngr@123',
              profile: u.profile as 'admin' | 'usuario',
              role: userRoleId,
              functions: u.functions as ('gerente' | 'import' | 'export' | 'cambio' | 'drawback' | 'recof' | 'suporte')[],
              teams: teamIds,
              hasAgenda: u.hasAgenda,
              active: u.active,
              mustChangePassword: u.mustChangePassword,
            });
          }
          return user;
        } catch (err: any) {
          console.error(`⚠️  Failed to create/update user ${u.email}:`, err.message);
          throw err;
        }
      })
    );
    
    const createdUsers = userResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
    
    const failedUsers = userResults.filter(result => result.status === 'rejected');
    if (failedUsers.length > 0) {
      console.warn(`⚠️  Failed to create/update ${failedUsers.length} users`);
    }
    console.log(`👥 Created/updated ${createdUsers.length} users (password: Ngr@123)`);

    // Create projects - usar upsert para evitar duplicação
    // Usar Promise.allSettled para continuar mesmo se alguns falharem
    const projectResults = await Promise.allSettled(
      projects.map(p =>
        Project.findOneAndUpdate(
          { projectId: p.projectId },
          {
            projectId: p.projectId,
            client: p.client,
            projectType: p.projectType,
            projectName: p.projectName,
            projectManager: p.projectManager,
            active: p.active,
            createdBy: admin._id,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    
    const createdProjects = projectResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
    
    const failedProjects = projectResults.filter(result => result.status === 'rejected');
    if (failedProjects.length > 0) {
      console.warn(`⚠️  Failed to create/update ${failedProjects.length} projects`);
    }
    console.log(`📁 Created/updated ${createdProjects.length} projects`);

    // Create allocations from exported data
    // Look for seed-allocations.json in server directory (when running from server/)
    const allocationsPath = path.join(process.cwd(), 'seed-allocations.json');
    if (fs.existsSync(allocationsPath)) {
      const allocationsData = JSON.parse(fs.readFileSync(allocationsPath, 'utf-8'));
      
      // Create maps for quick lookup
      const userMap = new Map(createdUsers.map(u => [u.email, u._id]));
      const projectMap = new Map(createdProjects.map(p => [p.projectId, p._id]));
      const adminId = admin._id;

      let allocationCount = 0;
      let skippedCount = 0;

      for (const allocData of allocationsData) {
        const consultantId = userMap.get(allocData.consultantEmail);
        if (!consultantId) {
          skippedCount++;
          continue;
        }

        const projectId = allocData.projectId ? projectMap.get(allocData.projectId) : null;
        const createdById = userMap.get(allocData.createdByEmail) || adminId;

        await Allocation.create({
          consultantId,
          projectId,
          date: new Date(allocData.date),
          period: allocData.period,
          timeSlot: allocData.timeSlot,
          status: allocData.status,
          createdBy: createdById,
        });
        allocationCount++;
      }

      console.log(`📅 Created ${allocationCount} allocations${skippedCount > 0 ? ` (${skippedCount} skipped - consultant not found)` : ''}`);
    } else {
      console.log('⚠️  seed-allocations.json not found, skipping allocations');
    }

    // Create data sync configs - usar upsert para evitar duplicação
    await Promise.all(
      dataSyncConfigs.map(config =>
        DataSyncConfig.findOneAndUpdate(
          { name: config.name },
          config,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );
    console.log(`🔄 Created/updated ${dataSyncConfigs.length} data sync configurations`);

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Administrador: admin@ngrglobal.com.br / Ngr@123');
    console.log('   Usuários: [email]@ngrglobal.com.br / Ngr@123');
    console.log('\n⚠️  Usuários precisarão trocar a senha no primeiro login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
