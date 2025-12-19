import { getMySQLConnection } from '../config/mysql.js';
import { DataSyncConfig, Project, User, Team } from '../models/index.js';
import {
  IDataSyncConfig,
  FieldMapping,
  Transformation,
  ExecutionLog,
} from '../types/index.js';

// Senha padrão para usuários sincronizados sem senha
const DEFAULT_PASSWORD = 'Ngr@123';

type TargetModel = typeof Project | typeof User | typeof Team;

const MODEL_MAP: Record<IDataSyncConfig['targetCollection'], TargetModel> = {
  projects: Project,
  users: User,
  teams: Team,
};

const FORBIDDEN_SQL = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];

const isFilterSafe = (filter?: string): boolean => {
  if (!filter) return true;
  const upper = filter.toUpperCase();
  return !FORBIDDEN_SQL.some((kw) => upper.includes(`${kw} `) || upper.includes(`${kw};`));
};

const applyTransformation = (value: any, transformation: Transformation): any => {
  switch (transformation.type) {
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'toNumber': {
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    }
    case 'toString':
      return value !== undefined && value !== null ? String(value) : '';
    case 'toDate': {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    case 'mapValue': {
      const map = transformation.options?.map || [];
      const found = map.find((m) => m.from === value);
      return found ? found.to : value;
    }
    case 'defaultValue':
      return value === undefined || value === null || value === '' ? transformation.options?.defaultValue : value;
    default:
      return value;
  }
};

const applyTransformations = (value: any, transformations?: Transformation[]) => {
  if (!transformations || transformations.length === 0) return value;
  return transformations.reduce((acc, t) => applyTransformation(acc, t), value);
};

const mapRecord = (row: any, mappings: FieldMapping[]): Record<string, any> => {
  const payload: Record<string, any> = {};
  mappings.forEach((map) => {
    const raw = row?.[map.sourceField];
    payload[map.targetField] = applyTransformations(raw, map.transformations);
  });
  return payload;
};

const buildQuery = (view: string, filter?: string) => {
  if (!filter || !filter.trim()) {
    return `SELECT * FROM \`${view}\``;
  }
  
  // Validar segurança do filtro
  if (!isFilterSafe(filter)) {
    const errorMsg = 'Cláusula de filtro contém comandos proibidos (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)';
    console.error(`[DataSync] ❌ Filtro SQL rejeitado por segurança: ${filter}`);
    throw new Error(errorMsg);
  }
  
  // Remover espaços extras e garantir que não começa com WHERE
  const cleanFilter = filter.trim().replace(/^WHERE\s+/i, '');
  
  // Validar sintaxe básica - verificar se tem operadores SQL válidos
  // Mas não ser muito restritivo para permitir expressões complexas
  const hasValidOperator = /(=|!=|<>|<|>|<=|>=|LIKE|IN|IS|NOT|AND|OR)/i.test(cleanFilter);
  if (!hasValidOperator && cleanFilter.length > 0) {
    console.warn(`[DataSync] ⚠️ Filtro SQL pode ter sintaxe inválida: ${cleanFilter}`);
  }
  
  // VALIDAÇÃO: Detectar datas sem aspas ou em formato incorreto
  // Padrões comuns de datas sem aspas: DD/MM/YYYY, DD-MM-YYYY, etc
  const datePatterns = [
    /\d{2}\/\d{2}\/\d{4}/,  // DD/MM/YYYY
    /\d{2}-\d{2}-\d{4}/,   // DD-MM-YYYY
    /\d{1,2}\/\d{1,2}\/\d{4}/, // D/M/YYYY
  ];
  
  const hasUnquotedDate = datePatterns.some(pattern => pattern.test(cleanFilter));
  if (hasUnquotedDate) {
    console.error(`[DataSync] ❌ ATENÇÃO: Filtro contém data sem aspas ou em formato incorreto!`);
    console.error(`[DataSync] Filtro: ${cleanFilter}`);
    console.error(`[DataSync] Datas devem estar entre aspas simples e no formato 'YYYY-MM-DD'`);
    console.error(`[DataSync] Exemplo correto: created_at >= '2025-01-01'`);
    console.error(`[DataSync] Exemplo incorreto: created_at >= 01/01/2025`);
    throw new Error(`Formato de data inválido no filtro SQL. Use 'YYYY-MM-DD' com aspas simples. Exemplo: created_at >= '2025-01-01'`);
  }
  
  const where = ` WHERE ${cleanFilter}`;
  const query = `SELECT * FROM \`${view}\`${where}`;
  
  console.log(`[DataSync] Query construída: ${query}`);
  
  return query;
};

const trimHistory = (config: IDataSyncConfig, entry: ExecutionLog) => {
  // Garantir que config.history existe e é um array
  if (!config.history || !Array.isArray(config.history)) {
    config.history = [];
  }
  
  // Criar uma cópia do histórico atual
  const history = [...config.history];
  
  // Adicionar nova execução no início
  history.unshift(entry);
  
  // Manter apenas as 5 últimas execuções
  while (history.length > 5) {
    history.pop();
  }
  
  // Atualizar o histórico da configuração
  config.history = history;
  
  console.log(`[DataSync] Histórico atualizado: ${history.length} execuções (máximo: 5)`);
};

interface ErrorInfo {
  type: 'validation' | 'duplicate' | 'required' | 'processing' | 'system';
  message: string;
  count: number;
  examples: string[];
}

export const executeDataSync = async (configId: string, userId?: string) => {
  const config = await DataSyncConfig.findById(configId);
  if (!config) {
    throw new Error('Configuração não encontrada');
  }

  // Buscar usuário admin para usar como createdBy padrão
  let defaultCreatedBy: any = null;
  try {
    const adminUser = await User.findOne({ profile: 'admin', active: true });
    if (adminUser) {
      defaultCreatedBy = adminUser._id;
      console.log(`[DataSync] Usuário admin encontrado para createdBy: ${adminUser.email} (${adminUser._id})`);
    } else if (userId) {
      defaultCreatedBy = userId;
      console.log(`[DataSync] Usando userId fornecido para createdBy: ${userId}`);
    } else {
      console.warn('[DataSync] ⚠️ Nenhum usuário admin encontrado e nenhum userId fornecido. Projetos podem falhar se createdBy for obrigatório.');
    }
  } catch (err) {
    console.error('[DataSync] ❌ Erro ao buscar usuário admin para createdBy:', err);
  }

  const startedAt = new Date();
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let message: string | undefined;
  const errorMap = new Map<string, ErrorInfo>();

  try {
    // Validação de segurança do filtro (será feita novamente em buildQuery, mas fazemos aqui para logar)
    if (config.filterClause && !isFilterSafe(config.filterClause)) {
      const errorMsg = 'Cláusula de filtro contém comandos proibidos (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)';
      console.error(`[DataSync] ❌ Filtro SQL rejeitado por segurança: ${config.filterClause}`);
      throw new Error(errorMsg);
    }

    const connection = getMySQLConnection();
    const query = buildQuery(config.sourceView, config.filterClause);
    
    console.log(`[DataSync] ===== INICIANDO SINCRONIZAÇÃO =====`);
    console.log(`[DataSync] Config: ${config.name}`);
    console.log(`[DataSync] Origem: ${config.sourceView}`);
    console.log(`[DataSync] Destino: ${config.targetCollection}`);
    if (config.filterClause) {
      console.log(`[DataSync] Filtro SQL: ${config.filterClause}`);
    }
    console.log(`[DataSync] Query executada: ${query}`);
    
    let rows: any;
    let data: any[] = [];
    let totalRecords = 0;
    
    try {
      // Executar query sem filtro primeiro para comparar (apenas se houver filtro)
      let totalWithoutFilter = 0;
      if (config.filterClause && config.filterClause.trim()) {
        try {
          const [rowsNoFilter] = await connection.query(`SELECT COUNT(*) as count FROM \`${config.sourceView}\``);
          totalWithoutFilter = Array.isArray(rowsNoFilter) && rowsNoFilter.length > 0 
            ? (rowsNoFilter[0] as any).count || 0 
            : 0;
          console.log(`[DataSync] Total de registros na view SEM filtro: ${totalWithoutFilter}`);
        } catch (countError) {
          console.warn(`[DataSync] Não foi possível contar registros sem filtro:`, countError);
        }
      }
      
      [rows] = await connection.query(query);
      data = Array.isArray(rows) ? rows : [];
      totalRecords = data.length;
      console.log(`[DataSync] ✅ Query executada com sucesso. ${totalRecords} registros retornados.`);
      
      // VALIDAÇÃO CRÍTICA: Se o filtro foi fornecido mas retornou o mesmo número de registros, há problema
      if (config.filterClause && config.filterClause.trim() && totalWithoutFilter > 0) {
        const difference = Math.abs(totalRecords - totalWithoutFilter);
        const percentageDiff = (difference / totalWithoutFilter) * 100;
        
        // Se a diferença for menor que 1%, provavelmente o filtro não funcionou
        if (percentageDiff < 1 && totalRecords === totalWithoutFilter) {
          console.error(`[DataSync] ❌❌❌ FILTRO SQL NÃO ESTÁ FUNCIONANDO!`);
          console.error(`[DataSync] Registros sem filtro: ${totalWithoutFilter}`);
          console.error(`[DataSync] Registros com filtro: ${totalRecords}`);
          console.error(`[DataSync] Filtro fornecido: ${config.filterClause}`);
          console.error(`[DataSync] Query executada: ${query}`);
          console.error(`[DataSync] ⚠️ O filtro retornou o mesmo número de registros - provavelmente há erro de sintaxe!`);
          console.error(`[DataSync] Dica: Verifique o formato de datas. Use 'YYYY-MM-DD' com aspas, ex: created_at >= '2025-01-01'`);
          
          // Adicionar ao erro para o histórico
          message = `Filtro SQL não está funcionando: retornou ${totalRecords} registros (mesmo que sem filtro). Verifique a sintaxe, especialmente formato de datas. Use 'YYYY-MM-DD' com aspas.`;
        } else if (percentageDiff < 5) {
          console.warn(`[DataSync] ⚠️ ATENÇÃO: Filtro pode não estar funcionando corretamente.`);
          console.warn(`[DataSync] Diferença muito pequena: ${difference} registros (${percentageDiff.toFixed(2)}%)`);
        }
      }
      
      // Validar se o filtro foi aplicado corretamente (verificação adicional)
      if (config.filterClause && totalRecords > 0) {
        // Verificar se há registros que violam o filtro (ex: project_number nulo quando filtro diz "is not null")
        // Isso é uma validação básica - não pode detectar todos os casos, mas ajuda
        const filterLower = config.filterClause.toLowerCase();
        if (filterLower.includes('is not null') && config.sourceKeyField) {
          const nullCount = data.filter(row => {
            const fieldName = config.sourceKeyField.toLowerCase();
            const value = row[fieldName] ?? row[config.sourceKeyField];
            return value === null || value === undefined || value === '';
          }).length;
          
          if (nullCount > 0) {
            console.warn(`[DataSync] ⚠️ ATENÇÃO: ${nullCount} registros têm ${config.sourceKeyField} nulo, mas o filtro SQL inclui "is not null"`);
            console.warn(`[DataSync] Isso pode indicar que o filtro não está funcionando corretamente ou há problema na sintaxe.`);
          }
        }
      }
    } catch (sqlError: any) {
      // Erro na execução da query SQL
      const sqlErrorMessage = sqlError.message || 'Erro desconhecido na query SQL';
      const sqlErrorCode = sqlError.code || 'UNKNOWN';
      
      console.error(`[DataSync] ❌ ERRO NA QUERY SQL:`);
      console.error(`[DataSync] Query: ${query}`);
      console.error(`[DataSync] Código do erro: ${sqlErrorCode}`);
      console.error(`[DataSync] Mensagem: ${sqlErrorMessage}`);
      if (sqlError.sql) {
        console.error(`[DataSync] SQL executado: ${sqlError.sql}`);
      }
      if (sqlError.sqlMessage) {
        console.error(`[DataSync] Mensagem SQL: ${sqlError.sqlMessage}`);
      }
      
      // Criar erro detalhado para o histórico
      const finishedAt = new Date();
      const errorMessage = `Erro na execução da query SQL: ${sqlErrorMessage}. Verifique a sintaxe da cláusula WHERE.`;
      
      // Recarregar configuração para salvar o erro
      const freshConfig = await DataSyncConfig.findById(configId);
      if (freshConfig) {
        trimHistory(freshConfig, {
          status: 'error',
          startedAt,
          finishedAt,
          inserted: 0,
          updated: 0,
          failed: 0,
          message: errorMessage,
          errors: [{
            type: 'system',
            message: `Erro SQL: ${sqlErrorMessage} (Código: ${sqlErrorCode})`,
            count: 1,
            examples: [
              `Query: ${query}`,
              `Filtro fornecido: ${config.filterClause || 'nenhum'}`,
              sqlError.sqlMessage || sqlErrorMessage,
            ],
          }],
          totalRecords: 0,
        });
        await freshConfig.save();
      }
      
      throw new Error(errorMessage);
    }
    
    console.log(`[DataSync] Total de registros retornados: ${totalRecords}`);
    
    // Verificar e filtrar registros com chave nula (mesmo com filtro SQL)
    // Isso garante que mesmo se o filtro SQL não funcionar corretamente, não processaremos registros inválidos
    let validData = data;
    if (totalRecords > 0 && config.sourceKeyField) {
      const nullKeyRows = data.filter(row => {
        const keyValue = row?.[config.sourceKeyField];
        return keyValue === undefined || keyValue === null || (typeof keyValue === 'string' && keyValue.trim() === '');
      });
      
      if (nullKeyRows.length > 0) {
        console.warn(`[DataSync] ⚠️ ATENÇÃO: ${nullKeyRows.length} registros têm chave (${config.sourceKeyField}) nula/vazia, mesmo com filtro SQL aplicado!`);
        console.warn(`[DataSync] Filtro SQL fornecido: ${config.filterClause || 'nenhum'}`);
        console.warn(`[DataSync] Estes registros serão ignorados automaticamente.`);
        console.warn(`[DataSync] Dica: Verifique se o filtro SQL está correto. Para datas, use formato 'YYYY-MM-DD' ou função DATE().`);
        
        // Filtrar os registros com chave nula
        validData = data.filter(row => {
          const keyValue = row?.[config.sourceKeyField];
          return keyValue !== undefined && keyValue !== null && !(typeof keyValue === 'string' && keyValue.trim() === '');
        });
        
        console.log(`[DataSync] Registros válidos após filtro de chave: ${validData.length} de ${totalRecords}`);
      }
    }

    const Model = MODEL_MAP[config.targetCollection];
    if (!Model) {
      throw new Error('Destino não suportado');
    }

    // Verificar quantos registros existem no banco ANTES de processar
    const existingCount = await Model.countDocuments({});
    console.log(`[DataSync] ===== VERIFICAÇÃO INICIAL =====`);
    console.log(`[DataSync] Registros existentes no banco ANTES da sincronização: ${existingCount}`);
    
    if (existingCount === 0) {
      console.log(`[DataSync] ⚠️ BANCO VAZIO - Todos os registros devem ser INSERIDOS, não atualizados!`);
    } else {
      // Verificar alguns registros existentes para debug
      const sampleRecords = await Model.find({}).limit(3).select(config.targetKeyField).lean();
      console.log(`[DataSync] Exemplos de chaves existentes:`, sampleRecords.map((r: any) => ({
        [config.targetKeyField]: r[config.targetKeyField],
        tipo: typeof r[config.targetKeyField]
      })));
    }

    // Usar validData em vez de data para processar apenas registros válidos
    for (let i = 0; i < validData.length; i++) {
      const row = validData[i];
      try {
        const payload = mapRecord(row, config.mappings || []);
        const sourceKey = row?.[config.sourceKeyField];
        let targetKeyValue = payload?.[config.targetKeyField];

        // Se targetKeyValue não está no payload, usar sourceKey
        if (targetKeyValue === undefined && sourceKey !== undefined) {
          targetKeyValue = sourceKey;
          payload[config.targetKeyField] = targetKeyValue;
        }

        // Validar chave de origem
        if (sourceKey === undefined || sourceKey === null || (typeof sourceKey === 'string' && sourceKey.trim() === '')) {
          failed += 1;
          const errorKey = `Campo chave de origem (${config.sourceKeyField}) está vazio ou nulo`;
          const errorInfo = errorMap.get(errorKey) || { type: 'validation', message: errorKey, count: 0, examples: [] };
          errorInfo.count += 1;
          if (errorInfo.examples.length < 3) {
            errorInfo.examples.push(`Registro ${i + 1}: ${JSON.stringify(row).substring(0, 100)}`);
          }
          errorMap.set(errorKey, errorInfo);
          continue;
        }

        // Validar chave de destino
        if (targetKeyValue === undefined || targetKeyValue === null || (typeof targetKeyValue === 'string' && targetKeyValue.trim() === '')) {
          failed += 1;
          const errorKey = `Campo chave de destino (${config.targetKeyField}) está vazio ou nulo após mapeamento`;
          const errorInfo = errorMap.get(errorKey) || { type: 'validation', message: errorKey, count: 0, examples: [] };
          errorInfo.count += 1;
          if (errorInfo.examples.length < 3) {
            errorInfo.examples.push(`Chave origem: ${sourceKey}, Payload: ${JSON.stringify(payload).substring(0, 100)}`);
          }
          errorMap.set(errorKey, errorInfo);
          continue;
        }

        // Validar campos obrigatórios ANTES de adicionar createdBy
        const validationErrors: string[] = [];
        if (config.targetCollection === 'projects') {
          if (!payload.projectId) validationErrors.push('projectId');
          if (!payload.client) validationErrors.push('client');
          if (!payload.projectName) validationErrors.push('projectName');
        } else if (config.targetCollection === 'users') {
          if (!payload.name) validationErrors.push('name');
          if (!payload.email) validationErrors.push('email');
        } else if (config.targetCollection === 'teams') {
          if (!payload.name) validationErrors.push('name');
        }

        if (validationErrors.length > 0) {
          failed += 1;
          const errorKey = `Campos obrigatórios ausentes: ${validationErrors.join(', ')}`;
          const errorInfo = errorMap.get(errorKey) || { type: 'required', message: errorKey, count: 0, examples: [] };
          errorInfo.count += 1;
          if (errorInfo.examples.length < 3) {
            errorInfo.examples.push(`Chave: ${sourceKey}, Payload: ${JSON.stringify(payload).substring(0, 150)}`);
          }
          errorMap.set(errorKey, errorInfo);
          continue;
        }

        // Adicionar createdBy para projetos se necessário (DEPOIS da validação básica)
        // IMPORTANTE: Remover createdBy se for undefined/null para garantir que o valor padrão seja usado
        if (config.targetCollection === 'projects') {
          // Se createdBy está undefined, null ou string vazia, remover do payload
          if (payload.createdBy === undefined || payload.createdBy === null || payload.createdBy === '') {
            delete payload.createdBy;
          }
          
          // Se ainda não tem createdBy, usar o padrão
          if (!payload.createdBy) {
            if (defaultCreatedBy) {
              payload.createdBy = defaultCreatedBy;
              // Log apenas para os primeiros registros para não poluir
              if (i < 3) {
                console.log(`[DataSync] Adicionado createdBy padrão ao registro ${i + 1}: ${defaultCreatedBy}`);
              }
            } else {
              // Se não há usuário admin, falhar com erro claro
              failed += 1;
              const errorKey = `createdBy é obrigatório para projetos e nenhum usuário admin foi encontrado`;
              const errorInfo = errorMap.get(errorKey) || { type: 'required', message: errorKey, count: 0, examples: [] };
              errorInfo.count += 1;
              if (errorInfo.examples.length < 3) {
                errorInfo.examples.push(`Chave: ${sourceKey}, Payload: ${JSON.stringify(payload).substring(0, 150)}`);
              }
              errorMap.set(errorKey, errorInfo);
              continue;
            }
          }
        }

        // PROTEÇÃO ABSOLUTA: Se o banco estava vazio no início, NUNCA buscar - sempre inserir
        let existing = null;
        
        // Verificar novamente se o banco ainda está vazio (proteção contra race conditions)
        const currentCount = await Model.countDocuments({});
        
        if (existingCount === 0) {
          // Banco estava vazio no início - NUNCA buscar, SEMPRE inserir
          if (i < 3) {
            console.log(`[DataSync] [${i + 1}/${validData.length}] 🔒 PROTEÇÃO ATIVA: Banco estava vazio (${existingCount}) - pulando busca e forçando inserção`);
            console.log(`[DataSync] Contagem atual: ${currentCount} (deve ser 0 ou igual ao número de registros já processados)`);
          }
          // existing permanece null - isso é GARANTIDO
        } else if (currentCount === 0 && existingCount > 0) {
          // Situação estranha: existingCount dizia que havia registros, mas agora está vazio
          console.warn(`[DataSync] ⚠️ ATENÇÃO: existingCount era ${existingCount} mas banco agora está vazio!`);
          console.warn(`[DataSync] Forçando inserção para este registro.`);
          // existing permanece null
        } else {
          // Banco tem registros - fazer busca normal
          // Normalizar o valor da chave para busca (trim se string)
          let searchKeyValue: any = targetKeyValue;
          if (typeof targetKeyValue === 'string') {
            searchKeyValue = targetKeyValue.trim();
          }
          
          // Buscar registro existente
          const query = { [config.targetKeyField]: searchKeyValue };
          
          // Log detalhado para os primeiros registros
          if (i < 3) {
            console.log(`[DataSync] [${i + 1}/${validData.length}] Buscando registro:`);
            console.log(`  - Query:`, JSON.stringify(query));
            console.log(`  - Valor original:`, targetKeyValue, `(tipo: ${typeof targetKeyValue})`);
            console.log(`  - Valor de busca:`, searchKeyValue, `(tipo: ${typeof searchKeyValue})`);
            console.log(`  - existingCount inicial: ${existingCount}, currentCount: ${currentCount}`);
          }
          
          existing = await Model.findOne(query);
          
          if (i < 3) {
            console.log(`  - Encontrado:`, existing ? 'SIM ⚠️' : 'NÃO ✅');
            if (existing) {
              console.log(`  - ID encontrado:`, existing._id);
              const foundKey = existing[config.targetKeyField as keyof typeof existing];
              console.log(`  - Valor da chave no banco:`, foundKey, `(tipo: ${typeof foundKey})`);
            }
          }
          
          // Validação crítica: verificar se realmente corresponde
          if (existing) {
            const foundKeyValue = existing[config.targetKeyField as keyof typeof existing];
            const foundType = typeof foundKeyValue;
            const searchType = typeof searchKeyValue;
            
            // Comparação estrita
            let valuesMatch = false;
            if (foundKeyValue === searchKeyValue) {
              valuesMatch = true;
            } else if (foundType === searchType && String(foundKeyValue) === String(searchKeyValue)) {
              valuesMatch = true;
            } else if (foundType === 'number' && searchType === 'number' && foundKeyValue === searchKeyValue) {
              valuesMatch = true;
            }
            
            if (!valuesMatch) {
              // FALSO POSITIVO - tratar como novo registro
              if (i < 3) {
                console.warn(`[DataSync] ⚠️ FALSO POSITIVO DETECTADO! Valores não correspondem.`);
                console.warn(`  - Valor buscado: ${searchKeyValue} (${searchType})`);
                console.warn(`  - Valor encontrado: ${foundKeyValue} (${foundType})`);
                console.warn(`  - Tratando como NOVO registro`);
              }
              existing = null;
            }
          }
        }
        
        // PROTEÇÃO FINAL ABSOLUTA: Se existingCount era 0, existing DEVE ser null
        // Se não for, é um bug crítico - forçar null
        if (existingCount === 0 && existing !== null) {
          console.error(`[DataSync] ❌❌❌ BUG CRÍTICO: existing não é null quando existingCount era 0!`);
          console.error(`[DataSync] existing:`, existing ? existing._id : 'null');
          console.error(`[DataSync] FORÇANDO existing = null (proteção absoluta)`);
          existing = null; // FORÇAR null
        }
        
        // PROTEÇÃO ABSOLUTA: Para projetos, SEMPRE forçar active = true
        // Isso garante que projetos nunca sejam desativados pela sincronização
        if (config.targetCollection === 'projects') {
          // SEMPRE definir active como true, independentemente do mapeamento
          payload.active = true;
          if (i < 3) {
            console.log(`[DataSync] 🔒 PROTEÇÃO: Forçando active = true para projeto (mesmo se mapeado como false)`);
          }
        }
        
        if (existing) {
          // Ao atualizar, preservar createdBy original se não foi fornecido
          if (config.targetCollection === 'projects' && !payload.createdBy && existing.createdBy) {
            payload.createdBy = existing.createdBy;
          }
          
          // Para usuários, NÃO atualizar password se vier vazio (manter o existente)
          // Isso evita sobrescrever senhas existentes durante sincronização
          if (config.targetCollection === 'users' && !payload.password) {
            delete payload.password; // Remove do payload para não sobrescrever
            console.log(`[DataSync] ⚠️ Usuário ${sourceKey}: senha não fornecida, mantendo senha existente`);
          }
          
          Object.assign(existing, payload);
          await existing.save();
          updated += 1;
        } else {
          // Ao criar, garantir que createdBy está presente
          if (config.targetCollection === 'projects' && !payload.createdBy && defaultCreatedBy) {
            payload.createdBy = defaultCreatedBy;
          }
          
          // Verificar novamente se createdBy está presente antes de criar
          if (config.targetCollection === 'projects' && !payload.createdBy) {
            failed += 1;
            const errorKey = `createdBy é obrigatório para projetos e não foi fornecido/encontrado`;
            const errorInfo = errorMap.get(errorKey) || { type: 'required', message: errorKey, count: 0, examples: [] };
            errorInfo.count += 1;
            if (errorInfo.examples.length < 3) {
              errorInfo.examples.push(`Chave: ${sourceKey}, Payload: ${JSON.stringify(payload).substring(0, 150)}`);
            }
            errorMap.set(errorKey, errorInfo);
            continue;
          }
          
          // Para usuários, aplicar senha padrão se não foi fornecida
          if (config.targetCollection === 'users' && !payload.password) {
            console.log(`[DataSync] ⚠️ Usuário sem senha (${sourceKey}), aplicando senha padrão`);
            payload.password = DEFAULT_PASSWORD;
            payload.mustChangePassword = true; // Forçar troca de senha no primeiro login
          }
          
          const created = new Model(payload);
          await created.save();
          inserted += 1;
        }
      } catch (err: any) {
        failed += 1;
        const error = err as Error;
        let errorMessage = error.message || 'Erro desconhecido';
        let errorType: ErrorInfo['type'] = 'processing';

        // Categorizar erros
        if (err.name === 'ValidationError' && err.errors) {
          errorType = 'validation';
          const validationErrors = Object.keys(err.errors).map(key => {
            const fieldError = err.errors[key];
            return `${key}: ${fieldError.message || fieldError}`;
          });
          errorMessage = `Erro de validação: ${validationErrors.join(', ')}`;
        } else if (err.code === 11000) {
          errorType = 'duplicate';
          errorMessage = `Registro duplicado: o valor da chave (${config.targetKeyField}) já existe no banco`;
        } else if (errorMessage.includes('required') || errorMessage.includes('obrigatório')) {
          errorType = 'required';
        } else if (err.name === 'MongoError' || err.name === 'MongooseError') {
          errorType = 'system';
        }

        const errorKey = errorMessage.length > 150 ? errorMessage.substring(0, 150) + '...' : errorMessage;
        const errorInfo = errorMap.get(errorKey) || { type: errorType, message: errorKey, count: 0, examples: [] };
        errorInfo.count += 1;
        if (errorInfo.examples.length < 3) {
          const sourceKey = row?.[config.sourceKeyField];
          const example = `Chave: ${sourceKey || 'N/A'}, Erro: ${errorMessage}`;
          errorInfo.examples.push(example.substring(0, 200));
        }
        errorMap.set(errorKey, errorInfo);

        if (!message) {
          message = errorMessage;
        }
      }
    }

    const finishedAt = new Date();
    const duration = (finishedAt.getTime() - startedAt.getTime()) / 1000;
    
    // Verificar quantos registros realmente existem no banco APÓS a sincronização
    const finalCount = await Model.countDocuments({});
    
    console.log(`[DataSync] ===== SINCRONIZAÇÃO CONCLUÍDA =====`);
    console.log(`[DataSync] Registros existentes ANTES: ${existingCount}`);
    console.log(`[DataSync] Registros existentes DEPOIS: ${finalCount}`);
    console.log(`[DataSync] Diferença (novos registros reais): ${finalCount - existingCount}`);
    
    // Validação crítica: se o banco estava vazio, não deveria ter atualizações
    if (existingCount === 0 && updated > 0) {
      console.error(`[DataSync] ❌ ERRO CRÍTICO: Contador mostra ${updated} atualizações, mas banco estava vazio!`);
      console.error(`[DataSync] Isso indica um problema na lógica de busca/upsert.`);
      console.error(`[DataSync] Esperado: ${inserted} inserções, 0 atualizações`);
      console.error(`[DataSync] Real: ${inserted} inserções, ${updated} atualizações`);
    }
    
    // Verificar se há discrepância entre contadores e banco real
    const expectedCount = existingCount + inserted;
    if (finalCount !== expectedCount) {
      console.warn(`[DataSync] ⚠️ DISCREPÂNCIA: Esperado ${expectedCount} registros, mas banco tem ${finalCount}`);
      console.warn(`[DataSync] Isso pode indicar que alguns saves() falharam silenciosamente.`);
    }
    
    const status: ExecutionLog['status'] =
      failed > 0 && (inserted > 0 || updated > 0) ? 'partial' : failed > 0 ? 'error' : 'success';

    // Converter errorMap para array
    const errors = Array.from(errorMap.values());

    // Criar mensagem resumida
    if (failed > 0 && !message) {
      if (errors.length === 1) {
        message = `${errors[0].message} (${errors[0].count} ocorrência${errors[0].count > 1 ? 's' : ''})`;
      } else {
        message = `${errors.length} tipos de erros encontrados (${failed} falhas no total)`;
      }
    } else if (status === 'success') {
      message = `Sincronização concluída com sucesso. ${inserted} inseridos, ${updated} atualizados.`;
    } else if (status === 'partial') {
      message = `Sincronização parcial: ${inserted} inseridos, ${updated} atualizados, ${failed} falhas.`;
    }

    console.log(`[DataSync] ===== SINCRONIZAÇÃO CONCLUÍDA =====`);
    console.log(`[DataSync] Status: ${status}`);
    console.log(`[DataSync] Inseridos: ${inserted}`);
    console.log(`[DataSync] Atualizados: ${updated}`);
    console.log(`[DataSync] Falhas: ${failed}`);
    console.log(`[DataSync] Duração: ${duration.toFixed(2)}s`);
    if (errors.length > 0) {
      console.log(`[DataSync] Tipos de erros: ${errors.length}`);
      errors.forEach((err, idx) => {
        console.log(`[DataSync]   ${idx + 1}. ${err.type}: ${err.message} (${err.count}x)`);
      });
    }

    // Usar validData.length para refletir apenas os registros que foram realmente processados
    const processedRecords = validData.length;
    
    // Recarregar a configuração para garantir que temos o histórico mais recente
    const freshConfig = await DataSyncConfig.findById(configId);
    if (freshConfig) {
      // Usar a configuração recarregada para preservar o histórico
      trimHistory(freshConfig, {
        status,
        startedAt,
        finishedAt,
        inserted,
        updated,
        failed,
        message,
        errors: errors.length > 0 ? errors : undefined,
        totalRecords: processedRecords, // Usar apenas registros válidos processados
      });
      
      console.log(`[DataSync] Salvando histórico: ${freshConfig.history.length} execuções`);
      await freshConfig.save();
    } else {
      // Fallback: usar a configuração em memória
      trimHistory(config, {
        status,
        startedAt,
        finishedAt,
        inserted,
        updated,
        failed,
        message,
        errors: errors.length > 0 ? errors : undefined,
        totalRecords: processedRecords, // Usar apenas registros válidos processados
      });
      await config.save();
    }

    return { status, inserted, updated, failed, total: processedRecords };
  } catch (error: any) {
    const finishedAt = new Date();
    let errorMessage = error.message || 'Erro desconhecido durante a execução';
    
    // Se for erro SQL, adicionar mais detalhes
    if (error.code && (error.code.startsWith('ER_') || error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL')) {
      errorMessage = `Erro SQL: ${errorMessage}`;
      if (error.sqlMessage) {
        errorMessage += ` (${error.sqlMessage})`;
      }
      if (error.sql) {
        console.error(`[DataSync] SQL que causou erro: ${error.sql}`);
      }
    }
    
    console.error(`[DataSync] ===== ERRO NA SINCRONIZAÇÃO =====`);
    console.error(`[DataSync] Erro: ${errorMessage}`);
    console.error(`[DataSync] Código: ${error.code || 'N/A'}`);
    if (error.sqlMessage) {
      console.error(`[DataSync] Mensagem SQL: ${error.sqlMessage}`);
    }
    if (error.stack) {
      console.error(`[DataSync] Stack:`, error.stack);
    }

    // Recarregar a configuração para garantir que temos o histórico mais recente
    const freshConfig = await DataSyncConfig.findById(configId);
    if (freshConfig) {
      trimHistory(freshConfig, {
        status: 'error',
        startedAt,
        finishedAt,
        inserted,
        updated,
        failed: failed || 1,
        message: errorMessage,
        errors: [{
          type: 'system',
          message: errorMessage,
          count: 1,
          examples: error.stack ? [error.stack.split('\n').slice(0, 3).join(' | ')] : [],
        }],
        totalRecords: data?.length || 0,
      });
      await freshConfig.save();
    } else {
      // Fallback: usar a configuração em memória
      trimHistory(config, {
        status: 'error',
        startedAt,
        finishedAt,
        inserted,
        updated,
        failed: failed || 1,
        message: errorMessage,
        errors: [{
          type: 'system',
          message: errorMessage,
          count: 1,
          examples: error.stack ? [error.stack.split('\n').slice(0, 3).join(' | ')] : [],
        }],
        totalRecords: data?.length || 0,
      });
      await config.save();
    }
    throw error;
  }
};

