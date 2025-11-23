import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import QRScanner from '../../components/QRScanner';
import { QRToken, Team, Criterion, Evaluation } from '../../types';
import { QRService } from '../../services/qrService';
import { socketService, SERVER_URL } from '../../services/socket';
import { StorageService } from '../../services/storage';
import { CRITERIA } from '../../config/constants';
import ConnectionIndicator from '../../components/ConnectionIndicator';
import { soundService } from '../../services/soundService';
import CustomAlert from '../../components/CustomAlert';

type Screen = 'scan' | 'evaluate' | 'history';

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  icon: string;
  buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'primary' | 'danger' }>;
}

export default function JudgeScreen() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('scan');
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [totemId, setTotemId] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    icon: '💬',
    buttons: [],
  });
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<Criterion | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [pendingEvaluations, setPendingEvaluations] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  
  // Nuevo estado: scores para todos los criterios del equipo actual
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});

  // Helper para mostrar alertas personalizadas
  const showAlert = (
    title: string,
    message: string,
    icon: string = '💬',
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'primary' | 'danger' }> = [
      { text: 'Entendido', style: 'primary' }
    ]
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      icon,
      buttons,
    });
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    // Cargar datos guardados (solo para historial)
    const loadSavedData = async () => {
      const savedEvaluations = await StorageService.getEvaluations();
      if (savedEvaluations) setEvaluations(savedEvaluations);
      
      // NO cargar judgeId ni totemId guardados
      // NO reconectar automáticamente - el usuario debe escanear QR cada vez
      console.log('📱 Modo Juez iniciado - Listo para escanear QR');
    };

    loadSavedData();

    // Inicializar servicio de sonido
    soundService.initialize();

    // Conectar socket
    const connectSocket = async () => {
      setConnectionStatus('connecting');
      console.log('🎯 URL final a usar:', SERVER_URL);
      try {
        await socketService.connect(SERVER_URL);
        setConnectionStatus('connected');

        // Escuchar cuando un equipo es enviado para evaluación completa
        socketService.on('team:received', (data: { team: Team }) => {
          const team = data.team;
          setActiveTeam(team);
          setCriteriaScores({}); // Resetear scores al recibir nuevo equipo
          
          // Cambiar a pantalla de evaluación automáticamente
          setCurrentScreen('evaluate');
          
          soundService.playNotificationSound();
          showAlert(
            'Nuevo Equipo para Evaluar', 
            `Evalúa a "${team.name}" en todos los criterios`,
            '🎯',
            [{ text: 'Iniciar Evaluación', style: 'primary' }]
          );
        });

        socketService.on('evaluation:received', () => {
          soundService.playEvaluationSound();
          showAlert('Éxito', 'Evaluación enviada correctamente', '✅');
          setSelectedScore(null);
        });

        socketService.on('evaluation:complete', (data: { teamId: string; judgeId: string; finalScore: number; teamName: string }) => {
          soundService.playEvaluationSound();
          console.log(`✅ Evaluación completa confirmada para ${data.teamName}: ${data.finalScore.toFixed(2)} puntos`);
        });

        socketService.on('evaluation:error', (data: { error: string }) => {
          showAlert('Error al Enviar Evaluación', data.error, '❌', [{ text: 'Entendido', style: 'danger' }]);
        });

        socketService.on('team:added', (team: Team) => {
          soundService.playNotificationSound();
          // Solo notificar, no cambiar de pantalla hasta que sea el equipo activo
          console.log(`Nuevo equipo registrado: ${team.name}`);
        });
      } catch (error) {
        setConnectionStatus('disconnected');
        console.error('Error conectando socket:', error);
      }
    };

    connectSocket();

    return () => {
      console.log('🔌 Desconectando Judge y limpiando datos...');
      socketService.disconnect();
      
      // Limpiar conexión (NO el historial de evaluaciones)
      setTotemId(null);
      setJudgeId(null);
      setActiveTeam(null);
      setActiveCriterion(null);
    };
  }, []);

  const connectToTotem = async (totemId: string, judgeId: string) => {
    setTotemId(totemId);
    setJudgeId(judgeId);
    
    // NO guardar en AsyncStorage para evitar reconexiones automáticas
    // Solo mantener en memoria durante la sesión actual
    console.log(`🔗 Conectando juez "${judgeId}" al totem "${totemId}"`);

    // Conectar juez al totem
    socketService.emit('judge:connect', { totemId, judgeId });
    
    // Solicitar lista de equipos
    socketService.emit('team:list', { totemId });

    socketService.on('judge:connected', (data) => {
      console.log('✅ Juez conectado exitosamente:', data);
      setCurrentScreen('evaluate');
    });

    socketService.on('judge:connection-error', (data: { error: string }) => {
      console.log('❌ Error de conexión:', data.error);
      showAlert(
        'Error de Conexión',
        data.error + '\n\nPor favor:\n1. Asegúrate de que el Modo Totem esté abierto\n2. Verifica que el QR sea válido\n3. Intenta escanear nuevamente',
        '❌',
        [{ text: 'Entendido', onPress: () => setCurrentScreen('scan'), style: 'danger' }]
      );
    });
  };

  const handleQRScan = async (token: QRToken) => {
    if (!token.totemId) {
      showAlert('Error', 'QR inválido', '⚠️', [{ text: 'Entendido', style: 'danger' }]);
      return;
    }

    // Generar ID de juez si no existe
    const newJudgeId = judgeId || `judge-${Date.now()}`;
    
    // Si el QR tiene equipo y criterio, actualizar
    if (token.teamId) {
      // Aquí deberías obtener el equipo del servidor
      // Por ahora usamos datos mock
    }

    if (token.criterionId) {
      const criterion = CRITERIA.find((c) => c.id === token.criterionId);
      if (criterion) {
        setActiveCriterion(criterion);
      }
    }

    await connectToTotem(token.totemId, newJudgeId);
  };

  const handleSubmitAllEvaluations = async () => {
    if (!activeTeam || !judgeId) {
      showAlert('Error', 'No hay equipo activo', '⚠️', [{ text: 'Entendido', style: 'danger' }]);
      return;
    }

    // Verificar que se hayan evaluado todos los criterios
    const totalCriteria = CRITERIA.length;
    const evaluatedCount = Object.keys(criteriaScores).length;
    
    if (evaluatedCount !== totalCriteria) {
      showAlert(
        'Evaluación Incompleta',
        `Has evaluado ${evaluatedCount} de ${totalCriteria} criterios. Por favor completa todos antes de enviar.`,
        '⚠️',
        [{ text: 'Entendido', style: 'primary' }]
      );
      return;
    }

    // Preparar evaluaciones para envío en batch
    const evaluationsToSend = Object.entries(criteriaScores).map(([criterionId, score]) => ({
      criterionId,
      score,
    }));

    // Enviar TODAS las evaluaciones en un solo evento (BATCH)
    socketService.emit('evaluation:submit-batch', {
      teamId: activeTeam.id,
      judgeId,
      evaluations: evaluationsToSend,
    });

    // Guardar localmente
    const newEvaluations: Evaluation[] = [];
    for (const [criterionId, score] of Object.entries(criteriaScores)) {
      const evaluation: Evaluation = {
        teamId: activeTeam.id,
        judgeId,
        criterionId,
        score,
        timestamp: new Date(),
      };
      await StorageService.addEvaluation(evaluation);
      newEvaluations.push(evaluation);
    }
    
    setEvaluations([...evaluations, ...newEvaluations]);
    
    // Reproducir sonido de confirmación
    soundService.playEvaluationSound();
    
    const teamName = activeTeam.name;
    
    // Limpiar estado para el siguiente equipo
    setCriteriaScores({});
    setActiveTeam(null);
    
    showAlert(
      'Evaluación Enviada',
      `Has evaluado exitosamente a "${teamName}" en todos los criterios.\n\nEsperando el siguiente equipo...`,
      '✅',
      [{ text: 'Entendido', style: 'primary' }]
    );
    
    // Mantener en pantalla de evaluación esperando el siguiente equipo
    // NO cambiar a setCurrentScreen('scan') porque ya está conectado
  };

  if (currentScreen === 'scan') {
    return (
      <>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Modo Juez</Text>
          <Text style={styles.subtitle}>Escanea el QR del totem</Text>
          <View style={styles.connectionContainer}>
            <ConnectionIndicator status={connectionStatus} />
          </View>
        </View>
          <QRScanner onScan={handleQRScan} />
          {totemId && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setCurrentScreen('history')}
            >
              <Text style={styles.historyButtonText}>Ver Historial</Text>
            </TouchableOpacity>
          )}
          </View>
        </SafeAreaView>
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          buttons={alertConfig.buttons}
          onClose={closeAlert}
        />
      </>
    );
  }

  if (currentScreen === 'evaluate') {
    return (
      <>
        <EvaluationScreenNew
          activeTeam={activeTeam}
          criteriaScores={criteriaScores}
          onScoreChange={(criterionId, score) => {
            setCriteriaScores(prev => ({ ...prev, [criterionId]: score }));
          }}
          onSubmitAll={handleSubmitAllEvaluations}
          onViewHistory={() => setCurrentScreen('history')}
          onBack={() => setCurrentScreen('scan')}
        />
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          buttons={alertConfig.buttons}
          onClose={closeAlert}
        />
      </>
    );
  }

  if (currentScreen === 'history') {
    return (
      <>
        <HistoryScreen
          evaluations={evaluations}
          onBack={() => setCurrentScreen(totemId ? 'evaluate' : 'scan')}
        />
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          buttons={alertConfig.buttons}
          onClose={closeAlert}
        />
      </>
    );
  }

  return null;
}

// Nueva Pantalla de Evaluación - Todos los criterios a la vez
function EvaluationScreenNew({
  activeTeam,
  criteriaScores,
  onScoreChange,
  onSubmitAll,
  onViewHistory,
  onBack,
}: {
  activeTeam: Team | null;
  criteriaScores: Record<string, number>;
  onScoreChange: (criterionId: string, score: number) => void;
  onSubmitAll: () => void;
  onViewHistory: () => void;
  onBack: () => void;
}) {
  const totalCriteria = CRITERIA.length;
  const evaluatedCount = Object.keys(criteriaScores).length;
  const allEvaluated = evaluatedCount === totalCriteria;

  return (
    <ScrollView style={styles.evaluateContainer}>
      <View style={styles.evaluateHeader}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onBack} style={styles.backButtonSmall}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.evaluateTitle}>Evaluación Completa</Text>
            <ConnectionIndicator status={'connected'} />
          </View>
        </View>
        <TouchableOpacity onPress={onViewHistory} style={styles.historyButtonSmall}>
          <Text style={styles.historyButtonTextSmall}>📋 Historial</Text>
        </TouchableOpacity>
      </View>

      {activeTeam ? (
        <>
          <View style={[styles.teamCard, styles.teamCardActive]}>
            <Text style={styles.teamLabel}>🎯 EQUIPO A EVALUAR</Text>
            <Text style={styles.teamName}>{activeTeam.name}</Text>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {evaluatedCount} de {totalCriteria} criterios evaluados
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(evaluatedCount / totalCriteria) * 100}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* Lista de Criterios */}
          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaSectionTitle}>
              📊 Evalúa todos los criterios (1-4 puntos cada uno)
            </Text>
            
            {CRITERIA.map((criterion, index) => {
              const selectedScore = criteriaScores[criterion.id];
              const isEvaluated = selectedScore !== undefined;
              
              return (
                <View key={criterion.id} style={styles.criterionEvalCard}>
                  <View style={styles.criterionEvalHeader}>
                    <View style={styles.criterionNumberBadge}>
                      <Text style={styles.criterionNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.criterionEvalInfo}>
                      <Text style={styles.criterionEvalName}>{criterion.name}</Text>
                      <Text style={styles.criterionEvalDescription} numberOfLines={2}>
                        {criterion.description}
                      </Text>
                    </View>
                    {isEvaluated && (
                      <View style={styles.evaluatedBadge}>
                        <Text style={styles.evaluatedBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>

                  {/* Niveles de evaluación */}
                  <View style={styles.levelsContainer}>
                    {criterion.niveles && criterion.niveles.map((nivel) => (
                      <TouchableOpacity
                        key={nivel.nivel}
                        style={[
                          styles.levelButton,
                          selectedScore === nivel.nivel && styles.levelButtonSelected,
                        ]}
                        onPress={() => onScoreChange(criterion.id, nivel.nivel)}
                      >
                        <View style={styles.levelButtonHeader}>
                          <Text style={[
                            styles.levelButtonNumber,
                            selectedScore === nivel.nivel && styles.levelButtonNumberSelected,
                          ]}>
                            {nivel.nivel}
                          </Text>
                          <Text style={[
                            styles.levelButtonName,
                            selectedScore === nivel.nivel && styles.levelButtonNameSelected,
                          ]}>
                            {nivel.nombre}
                          </Text>
                        </View>
                        <Text style={[
                          styles.levelButtonDescription,
                          selectedScore === nivel.nivel && styles.levelButtonDescriptionSelected,
                        ]} numberOfLines={2}>
                          {nivel.descripcion}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Botón de envío */}
          <TouchableOpacity
            style={[
              styles.submitAllButton,
              !allEvaluated && styles.submitAllButtonDisabled,
            ]}
            onPress={onSubmitAll}
            disabled={!allEvaluated}
          >
            <Text style={styles.submitAllButtonText}>
              {allEvaluated 
                ? '✅ ENVIAR EVALUACIÓN COMPLETA' 
                : `⏳ FALTAN ${totalCriteria - evaluatedCount} CRITERIOS`
              }
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.waitingContainer}>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.waitingTitle}>Esperando Siguiente Equipo</Text>
            <Text style={styles.waitingDescription}>
              El administrador enviará el próximo equipo a evaluar.{'\n'}
              Mantente conectado.
            </Text>
            <View style={styles.waitingStatusContainer}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Conectado al Totem</Text>
            </View>
          </View>
          
          <View style={styles.waitingActions}>
            <TouchableOpacity style={styles.historyButtonWaiting} onPress={onViewHistory}>
              <Text style={styles.historyButtonWaitingText}>📋 Ver Historial</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.backToScanButton} onPress={onBack}>
              <Text style={styles.backToScanButtonText}>🔄 Reconectar al Totem</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Pantalla de Evaluación (Antigua - mantener por compatibilidad)
function EvaluationScreen({
  activeTeam,
  activeCriterion,
  selectedScore,
  onScoreSelect,
  onSubmit,
  onViewHistory,
  pendingEvaluations,
}: {
  activeTeam: Team | null;
  activeCriterion: Criterion | null;
  selectedScore: number | null;
  onScoreSelect: (score: number) => void;
  onSubmit: () => void;
  onViewHistory: () => void;
  pendingEvaluations: number;
}) {
  return (
    <ScrollView style={styles.evaluateContainer}>
      <View style={styles.evaluateHeader}>
        <View>
          <Text style={styles.evaluateTitle}>Panel de Evaluación</Text>
          <ConnectionIndicator status={'connected'} />
        </View>
        <TouchableOpacity onPress={onViewHistory} style={styles.historyButtonSmall}>
          <Text style={styles.historyButtonTextSmall}>📋 Historial</Text>
        </TouchableOpacity>
      </View>

      {activeTeam ? (
        <View style={[styles.teamCard, styles.teamCardActive]}>
          <Text style={styles.teamLabel}>🎯 EQUIPO A EVALUAR</Text>
          <Text style={styles.teamName}>{activeTeam.name}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>● LISTO PARA EVALUAR</Text>
          </View>
        </View>
      ) : (
        <View style={styles.teamCard}>
          <Text style={styles.waitingText}>⏳ Esperando que el administrador seleccione un equipo...</Text>
        </View>
      )}

      {activeCriterion ? (
        <View style={[styles.criterionCard, styles.criterionCardActive]}>
          <Text style={styles.criterionLabel}>📊 CRITERIO DE EVALUACIÓN</Text>
          <Text style={styles.criterionName}>{activeCriterion.name}</Text>
          <Text style={styles.criterionDescription}>{activeCriterion.description}</Text>
          <View style={styles.maxScoreBadge}>
            <Text style={styles.maxScoreText}>
              Máximo: {activeCriterion.maxScore} puntos
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.criterionCard}>
          <Text style={styles.waitingText}>⏳ Esperando que el administrador seleccione un criterio...</Text>
        </View>
      )}

      {activeTeam && activeCriterion && (
        <View style={styles.scoringSection}>
          <Text style={styles.scoringTitle}>⭐ ASIGNA TU PUNTUACIÓN</Text>
          <Text style={styles.scoringSubtitle}>Selecciona del 1 al 4 según la rúbrica</Text>
          
          {/* Niveles de la rúbrica */}
          {activeCriterion.niveles && activeCriterion.niveles.length > 0 && (
            <View style={styles.rubricLevels}>
              {activeCriterion.niveles.map((nivel) => (
                <TouchableOpacity
                  key={nivel.nivel}
                  style={[
                    styles.rubricLevel,
                    selectedScore === nivel.nivel && styles.rubricLevelSelected,
                  ]}
                  onPress={() => onScoreSelect(nivel.nivel)}
                >
                  <View style={styles.rubricLevelHeader}>
                    <Text style={[
                      styles.rubricLevelNumber,
                      selectedScore === nivel.nivel && styles.rubricLevelNumberSelected,
                    ]}>
                      {nivel.nivel}
                    </Text>
                    <Text style={[
                      styles.rubricLevelName,
                      selectedScore === nivel.nivel && styles.rubricLevelNameSelected,
                    ]}>
                      {nivel.nombre}
                    </Text>
                  </View>
                  <Text style={[
                    styles.rubricLevelDescription,
                    selectedScore === nivel.nivel && styles.rubricLevelDescriptionSelected,
                  ]}>
                    {nivel.descripcion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {!activeTeam && !activeCriterion && (
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>💡 Instrucciones</Text>
          <Text style={styles.instructionText}>
            1. El administrador seleccionará el equipo a evaluar{'\n'}
            2. El administrador seleccionará el criterio{'\n'}
            3. Tú asignarás tu puntuación del 1 al 4{'\n'}
            4. Presiona "Enviar" para confirmar
          </Text>
        </View>
      )}

      {pendingEvaluations > 0 && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingText}>
            ⏱️ Esperando a {pendingEvaluations} {pendingEvaluations === 1 ? 'juez' : 'jueces'}
          </Text>
        </View>
      )}

      {activeTeam && activeCriterion && selectedScore && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={onSubmit}
        >
          <Text style={styles.submitButtonText}>✅ ENVIAR EVALUACIÓN</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Pantalla de Historial
function HistoryScreen({
  evaluations,
  onBack,
}: {
  evaluations: Evaluation[];
  onBack: () => void;
}) {
  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.historyTitle}>Historial de Evaluaciones</Text>
      </View>

      <ScrollView style={styles.historyList}>
        {evaluations.length === 0 ? (
          <Text style={styles.noHistory}>No hay evaluaciones registradas</Text>
        ) : (
          evaluations.map((evaluation, index) => {
            const criterion = CRITERIA.find((c) => c.id === evaluation.criterionId);
            return (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemTitle}>
                    {criterion?.name || 'Criterio desconocido'}
                  </Text>
                  <Text style={styles.historyItemScore}>{evaluation.score}/4</Text>
                </View>
                <Text style={styles.historyItemDate}>
                  {new Date(evaluation.timestamp).toLocaleString()}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  header: {
    backgroundColor: '#5dbba7',
    padding: 25,
    paddingTop: 60,
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#e0f7f3',
    fontWeight: '500',
  },
  connectionContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  historyButton: {
    backgroundColor: '#5dbba7',
    padding: 15,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  evaluateContainer: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  evaluateHeader: {
    backgroundColor: '#5dbba7',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  evaluateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyButtonSmall: {
    padding: 10,
  },
  historyButtonTextSmall: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  teamCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  teamCardActive: {
    backgroundColor: '#e8f5f2',
    borderWidth: 2,
    borderColor: '#5dbba7',
  },
  teamLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0a2f2a',
  },
  statusBadge: {
    marginTop: 12,
    backgroundColor: '#5dbba7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  criterionCard: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 25,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#a0d9cd',
  },
  criterionCardActive: {
    backgroundColor: '#e8f5f2',
    borderWidth: 2,
    borderColor: '#5dbba7',
  },
  criterionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  criterionName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0a2f2a',
    marginBottom: 10,
  },
  criterionDescription: {
    fontSize: 15,
    color: '#555',
    marginBottom: 12,
    lineHeight: 22,
  },
  maxScoreBadge: {
    backgroundColor: '#5dbba7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  maxScoreText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  waitingText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scoringSection: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scoringTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  scoringSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  rubricLevels: {
    gap: 12,
  },
  rubricLevel: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  rubricLevelSelected: {
    backgroundColor: '#e8f5f2',
    borderColor: '#5dbba7',
    borderWidth: 3,
    elevation: 3,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rubricLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  rubricLevelNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#757575',
    width: 40,
    textAlign: 'center',
  },
  rubricLevelNumberSelected: {
    color: '#5dbba7',
  },
  rubricLevelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  rubricLevelNameSelected: {
    color: '#0a2f2a',
  },
  rubricLevelDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingLeft: 52,
  },
  rubricLevelDescriptionSelected: {
    color: '#333',
    fontWeight: '500',
  },
  instructionCard: {
    backgroundColor: '#f0f9f7',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#5dbba7',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3a9989',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
  },
  pendingCard: {
    backgroundColor: '#e8f5f2',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#5dbba7',
  },
  pendingText: {
    fontSize: 14,
    color: '#0a2f2a',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#5dbba7',
    margin: 15,
    padding: 22,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  historyHeader: {
    backgroundColor: '#5dbba7',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyList: {
    flex: 1,
    padding: 15,
  },
  noHistory: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  historyItemScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5dbba7',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#999',
  },
  // Nuevos estilos para EvaluationScreenNew
  headerContent: {
    flex: 1,
  },
  backButtonSmall: {
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 15,
  },
  progressText: {
    fontSize: 14,
    color: '#0a2f2a',
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5dbba7',
    borderRadius: 4,
  },
  criteriaSection: {
    padding: 15,
  },
  criteriaSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  criterionEvalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  criterionEvalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  criterionNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5dbba7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  criterionNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  criterionEvalInfo: {
    flex: 1,
  },
  criterionEvalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  criterionEvalDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  evaluatedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5dbba7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  evaluatedBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  levelButton: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  levelButtonSelected: {
    backgroundColor: '#e8f5f2',
    borderColor: '#5dbba7',
    borderWidth: 3,
    elevation: 4,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  levelButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  levelButtonNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#757575',
    width: 28,
    textAlign: 'center',
  },
  levelButtonNumberSelected: {
    color: '#5dbba7',
  },
  levelButtonName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  levelButtonNameSelected: {
    color: '#0a2f2a',
  },
  levelButtonDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 15,
  },
  levelButtonDescriptionSelected: {
    color: '#333',
    fontWeight: '500',
  },
  submitAllButton: {
    backgroundColor: '#5dbba7',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitAllButtonDisabled: {
    backgroundColor: '#BDBDBD',
    elevation: 1,
  },
  submitAllButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f0f9f7',
  },
  waitingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#e8f5f2',
  },
  waitingIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a2f2a',
    marginBottom: 12,
    textAlign: 'center',
  },
  waitingDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  waitingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5f2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5dbba7',
    marginRight: 10,
  },
  connectedText: {
    color: '#0a2f2a',
    fontSize: 14,
    fontWeight: '600',
  },
  waitingActions: {
    gap: 12,
  },
  historyButtonWaiting: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#5dbba7',
    elevation: 2,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  historyButtonWaitingText: {
    color: '#5dbba7',
    fontSize: 16,
    fontWeight: '600',
  },
  backToScanButton: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backToScanButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
});
