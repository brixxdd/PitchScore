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
  sentToJudges?: boolean; // Indica si el equipo ya fue enviado para evaluación
  evaluationsCompleted?: number; // Contador de evaluaciones completadas
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
  'totem:connect': { totemId: string }; // Totem se conecta a su sala
  'judge:connect': { totemId: string; judgeId: string };
  'evaluation:submit': { teamId: string; criterionId: string; score: number; judgeId: string };
  'evaluation:submit-batch': { teamId: string; judgeId: string; evaluations: Array<{ criterionId: string; score: number }> }; // Enviar todas las evaluaciones a la vez
  'totem:change-team': { totemId: string; teamId: string };
  'totem:change-criterion': { totemId: string; criterionId: string };
  'team:add': Team;
  'team:list': { totemId: string };
  'team:send-to-judges': { totemId: string; teamId: string }; // Enviar equipo completo a jueces
  'system:reset-data': { password: string; totemId: string }; // Resetear todos los datos
  
  // Servidor -> Cliente
  'totem:connected': { totemId: string }; // Confirmación de conexión del Totem
  'judge:connected': { judgeId: string; order: number; pendingTeams?: Array<{ id: string; name: string }> };
  'judge:connection-error': { error: string }; // Error al conectar Judge
  'evaluation:status': { teamId: string; teamName: string; judgesExpected: string[]; judgesResponded: string[]; pendingJudges: string[]; allComplete: boolean };
  'team:updated': Team;
  'team:added': Team;
  'team:added:success': Team;
  'team:added:error': { error: string };
  'team:list:response': { teams: Team[] };
  'totem:team-changed': { teamId: string; teamName: string };
  'totem:criterion-changed': { criterionId: string; criterionName: string };
  'team:received': { team: Team }; // Equipo enviado a jueces para evaluación completa
  'evaluation:received': { teamId: string; criterionId: string; judgeId: string };
  'evaluation:complete': { teamId: string; judgeId: string; finalScore: number; teamName: string; allJudgesComplete?: boolean }; // Confirmación de evaluación completa
  'team:sent:success': { team: Team };
  'team:sent:error': { error: string };
  'evaluation:error': { error: string }; // Error al procesar evaluación
  'results:updated': { teams: Team[] };
  'system:reset-success': {}; // Confirmación de reset exitoso
  'system:reset-error': { error: string }; // Error al resetear
}

