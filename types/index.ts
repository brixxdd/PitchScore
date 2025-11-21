// Tipos para la aplicación

export interface Judge {
  id: string;
  name: string;
  totemId: string;
  order: number;
  lastActive: Date;
}

export interface Team {
  id: string;
  name: string;
  totemId: string;
  scores: Record<string, number>; // criterionId -> score
  finalScore: number;
  positionHistory: Array<{ timestamp: Date; position: number }>;
}

export interface CriterionLevel {
  nivel: number;
  nombre: string;
  descripcion: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  niveles?: CriterionLevel[];
}

export interface Evaluation {
  teamId: string;
  judgeId: string;
  criterionId: string;
  score: number;
  timestamp: Date;
}

export interface Totem {
  id: string;
  activeTeam: string | null;
  activeCriterion: string | null;
  status: 'idle' | 'active' | 'evaluating';
}

export interface QRToken {
  totemId: string;
  teamId?: string;
  criterionId?: string;
  expiresAt: number; // timestamp
}

export interface SocketEvents {
  // Cliente -> Servidor
  'judge:connect': { totemId: string; judgeId: string };
  'evaluation:submit': { teamId: string; criterionId: string; score: number; judgeId: string };
  'totem:change-team': { totemId: string; teamId: string };
  'totem:change-criterion': { totemId: string; criterionId: string };
  'team:add': Team;
  'team:list': { totemId: string };
  
  // Servidor -> Cliente
  'judge:connected': { judgeId: string; order: number };
  'team:updated': Team;
  'team:added': Team;
  'team:added:success': Team;
  'team:added:error': { error: string };
  'team:list:response': { teams: Team[] };
  'totem:team-changed': { teamId: string; teamName: string };
  'totem:criterion-changed': { criterionId: string; criterionName: string };
  'evaluation:received': { teamId: string; criterionId: string; judgeId: string };
  'results:updated': { teams: Team[] };
}

