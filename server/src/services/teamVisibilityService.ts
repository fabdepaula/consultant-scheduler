import User from '../models/User.js';
import Team from '../models/Team.js';
import { IUser, IRole } from '../types/index.js';

/**
 * Obtém os IDs das equipes que o usuário pode visualizar na agenda
 * @returns null se pode ver todas as equipes, array vazio se não pode ver nenhuma, ou array com IDs das equipes permitidas
 */
export const getAllowedTeamsForUser = async (userId: string): Promise<string[] | null> => {
  const user = await User.findById(userId).populate('role');

  if (!user || !user.role) {
    // Se não tem role, verifica profile antigo para compatibilidade
    if (user?.profile === 'admin') {
      return null; // Admin pode ver todas
    }
    return null; // Sem perfil = comportamento padrão (pode ver todas por enquanto)
  }

  const role = user.role as IRole;

  // Se não tem restrição de equipes (undefined/null), pode ver todas
  if (role.allowedTeams === undefined || role.allowedTeams === null) {
    return null; // null/undefined = todas as equipes
  }

  // Se o array está vazio, significa que não pode ver nenhuma equipe
  if (role.allowedTeams.length === 0) {
    return []; // Array vazio = nenhuma equipe
  }

  // Verificar se todas as equipes ativas estão selecionadas
  // Se sim, tratar como "sem restrição" (null)
  const totalActiveTeams = await Team.countDocuments({ active: true });
  const selectedTeamIds = role.allowedTeams.map(teamId => teamId.toString());
  
  // Se o número de equipes selecionadas é igual ao total de equipes ativas,
  // tratar como "sem restrição"
  if (selectedTeamIds.length >= totalActiveTeams) {
    // Verificar se realmente são todas as equipes ativas
    const activeTeamIds = (await Team.find({ active: true }).select('_id')).map(t => t._id.toString());
    const allTeamsSelected = activeTeamIds.every(id => selectedTeamIds.includes(id));
    
    if (allTeamsSelected) {
      return null; // Todas as equipes selecionadas = sem restrição
    }
  }

  // Retorna apenas os IDs das equipes permitidas
  return selectedTeamIds;
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

