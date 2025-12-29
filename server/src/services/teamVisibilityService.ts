import User from '../models/User.js';
import Team from '../models/Team.js';
import { IUser, IRole } from '../types/index.js';

/**
 * Obtém os IDs das equipes que o usuário pode visualizar na agenda
 * @returns null se pode ver todas as equipes, array vazio se não pode ver nenhuma, ou array com IDs das equipes permitidas
 */
export const getAllowedTeamsForUser = async (userId: string): Promise<string[] | null> => {
  // Buscar role sem populate primeiro para ver o formato original
  const userRaw = await User.findById(userId).select('role profile');
  const roleId = userRaw?.role;
  
  // Agora buscar o role completo com allowedTeams
  const user = await User.findById(userId).populate({
    path: 'role',
    populate: { path: 'allowedTeams' }
  });

  if (!user) {
    console.log('[teamVisibilityService] No user found');
    return []; // Sem usuário = sem acesso (restrito)
  }

  // PRIORIDADE: Se tem role, usar as configurações do role (mesmo que seja admin)
  // Verificar se role está populado (não é apenas ObjectId)
  if (user.role && typeof user.role === 'object' && '_id' in user.role) {
    const role = user.role as unknown as IRole;

    console.log('[teamVisibilityService] Role found:', {
      roleId: role._id,
      roleName: role.name,
      allowedTeams: role.allowedTeams,
      allowedTeamsType: typeof role.allowedTeams,
      isArray: Array.isArray(role.allowedTeams),
      length: role.allowedTeams?.length
    });

    // Se não tem restrição de equipes (undefined/null), NÃO pode ver nenhuma (restrito)
    if (role.allowedTeams === undefined || role.allowedTeams === null) {
      console.log('[teamVisibilityService] No allowedTeams (undefined/null) - returning []');
      return []; // null/undefined = nenhuma equipe (restrito)
    }

    // Se o array está vazio, significa que não pode ver nenhuma equipe
    if (role.allowedTeams.length === 0) {
      console.log('[teamVisibilityService] Empty allowedTeams array - returning []');
      return []; // Array vazio = nenhuma equipe
    }

    // Retorna apenas os IDs das equipes permitidas
    const teamIds = role.allowedTeams.map((teamId: any) => {
      console.log('[teamVisibilityService] Processing teamId:', {
        teamId,
        type: typeof teamId,
        isObject: typeof teamId === 'object',
        hasId: teamId?._id,
        constructor: teamId?.constructor?.name
      });
      
      // Se teamId é um objeto (populated Team), usar _id
      if (typeof teamId === 'object' && teamId !== null) {
        // Se tem _id (objeto Team populado)
        if (teamId._id) {
          const id = teamId._id.toString();
          console.log('[teamVisibilityService] Extracted ID from populated Team:', id);
          return id;
        }
        // Se é um ObjectId diretamente (mongoose.Types.ObjectId)
        if (teamId.toString && typeof teamId.toString === 'function') {
          const id = teamId.toString();
          console.log('[teamVisibilityService] Extracted ID from ObjectId:', id);
          return id;
        }
      }
      // Se já é uma string
      if (typeof teamId === 'string') {
        console.log('[teamVisibilityService] Using string ID directly:', teamId);
        return teamId;
      }
      // Último recurso: converter para string
      const id = String(teamId);
      console.log('[teamVisibilityService] Converted to string:', id);
      return id;
    }).filter(Boolean); // Remove valores nulos/undefined

    console.log('[teamVisibilityService] Final team IDs:', teamIds);
    return teamIds;
  }

  // FALLBACK: Se não tem role, verifica profile antigo para compatibilidade
  if (user.profile === 'admin') {
    console.log('[teamVisibilityService] Fallback: admin profile - returning null (all teams)');
    return null; // Admin antigo pode ver todas
  }

  console.log('[teamVisibilityService] No role and not admin - returning []');
  return []; // Sem role e não é admin = sem acesso (restrito)
};

/**
 * Verifica se o usuário pode visualizar uma equipe específica
 */
export const canUserViewTeam = async (userId: string, teamId: string): Promise<boolean> => {
  const allowedTeams = await getAllowedTeamsForUser(userId);

  // Se null, pode ver todas
  if (allowedTeams === null) {
    return true;
  }

  // Se array vazio, não pode ver nenhuma
  if (allowedTeams.length === 0) {
    return false;
  }

  // Verifica se a equipe está na lista permitida
  return allowedTeams.includes(teamId);
};

/**
 * Obtém as equipes visíveis para o usuário (objetos completos)
 */
export const getVisibleTeamsForUser = async (userId: string) => {
  const allowedTeamIds = await getAllowedTeamsForUser(userId);

  // Se pode ver todas, retorna todas as equipes ativas
  if (allowedTeamIds === null) {
    return await Team.find({ active: true }).select('_id name active');
  }

  // Se não pode ver nenhuma, retorna array vazio
  if (allowedTeamIds.length === 0) {
    return [];
  }

  // Retorna apenas as equipes permitidas e ativas
  return await Team.find({
    _id: { $in: allowedTeamIds },
    active: true
  }).select('_id name active');
};

