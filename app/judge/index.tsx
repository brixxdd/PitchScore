import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import QRScanner from '../../components/QRScanner';
import { QRToken, Team, Criterion, Evaluation } from '../../types';
import { QRService } from '../../services/qrService';
import { socketService } from '../../services/socket';
import { StorageService } from '../../services/storage';
import { CRITERIA } from '../../config/constants';
import ConnectionIndicator from '../../components/ConnectionIndicator';
import { soundService } from '../../services/soundService';

type Screen = 'scan' | 'evaluate' | 'history';

export default function JudgeScreen() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('scan');
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [totemId, setTotemId] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<Criterion | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [pendingEvaluations, setPendingEvaluations] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    // Cargar datos guardados
    const loadSavedData = async () => {
      const savedJudgeId = await StorageService.getJudgeId();
      const savedTotemId = await StorageService.getTotemId();
      const savedEvaluations = await StorageService.getEvaluations();

      if (savedJudgeId) setJudgeId(savedJudgeId);
      if (savedTotemId) setTotemId(savedTotemId);
      if (savedEvaluations) setEvaluations(savedEvaluations);

      // Si ya hay conexión, ir a evaluación
      if (savedJudgeId && savedTotemId) {
        connectToTotem(savedTotemId, savedJudgeId);
      }
    };

    loadSavedData();

    // Inicializar servicio de sonido
    soundService.initialize();

    // Conectar socket
    const connectSocket = async () => {
      setConnectionStatus('connecting');
      const SERVER_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        await socketService.connect(SERVER_URL);
        setConnectionStatus('connected');

        // Escuchar cambios del totem
        socketService.on('totem:team-changed', (data) => {
          // Actualizar equipo activo
          const team: Team = {
            id: data.teamId,
            name: data.teamName,
            totemId: totemId || '',
            scores: {},
            finalScore: 0,
            positionHistory: [],
          };
          setActiveTeam(team);
          setSelectedScore(null);
          
          // Cambiar a pantalla de evaluación automáticamente
          setCurrentScreen('evaluate');
          
          soundService.playNotificationSound();
          Alert.alert('Equipo Asignado', `Evalúa a: ${data.teamName}`);
        });

        socketService.on('totem:criterion-changed', (data) => {
          const criterion = CRITERIA.find((c) => c.id === data.criterionId);
          if (criterion) {
            setActiveCriterion(criterion);
            setSelectedScore(null);
            
            // Si ya hay equipo activo, cambiar a evaluación
            if (activeTeam) {
              setCurrentScreen('evaluate');
            }
            
            soundService.playNotificationSound();
            Alert.alert('Criterio Asignado', `Evalúa: ${criterion.name}`);
          }
        });

        socketService.on('evaluation:received', () => {
          soundService.playEvaluationSound();
          Alert.alert('Éxito', 'Evaluación enviada correctamente');
          setSelectedScore(null);
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
      socketService.disconnect();
    };
  }, []);

  const connectToTotem = async (totemId: string, judgeId: string) => {
    setTotemId(totemId);
    setJudgeId(judgeId);
    await StorageService.saveTotemId(totemId);
    await StorageService.saveJudgeId(judgeId);

    // Conectar juez al totem
    socketService.emit('judge:connect', { totemId, judgeId });
    
    // Solicitar lista de equipos
    socketService.emit('team:list', { totemId });

    socketService.on('judge:connected', (data) => {
      console.log('Juez conectado:', data);
      setCurrentScreen('evaluate');
    });
  };

  const handleQRScan = async (token: QRToken) => {
    if (!token.totemId) {
      Alert.alert('Error', 'QR inválido');
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

  const handleSubmitEvaluation = async () => {
    if (!selectedScore || !activeTeam || !activeCriterion || !judgeId) {
      Alert.alert('Error', 'Por favor selecciona una puntuación');
      return;
    }

    const evaluation: Evaluation = {
      teamId: activeTeam.id,
      judgeId,
      criterionId: activeCriterion.id,
      score: selectedScore,
      timestamp: new Date(),
    };

    // Enviar al servidor
    socketService.emit('evaluation:submit', {
      teamId: activeTeam.id,
      judgeId,
      criterionId: activeCriterion.id,
      score: selectedScore,
    });

    // Guardar localmente
    await StorageService.addEvaluation(evaluation);
    setEvaluations([...evaluations, evaluation]);
    setSelectedScore(null);
    
    // Reproducir sonido de confirmación
    soundService.playEvaluationSound();
  };

  if (currentScreen === 'scan') {
    return (
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
    );
  }

  if (currentScreen === 'evaluate') {
    return (
      <EvaluationScreen
        activeTeam={activeTeam}
        activeCriterion={activeCriterion}
        selectedScore={selectedScore}
        onScoreSelect={setSelectedScore}
        onSubmit={handleSubmitEvaluation}
        onViewHistory={() => setCurrentScreen('history')}
        pendingEvaluations={pendingEvaluations}
      />
    );
  }

  if (currentScreen === 'history') {
    return (
      <HistoryScreen
        evaluations={evaluations}
        onBack={() => setCurrentScreen(totemId ? 'evaluate' : 'scan')}
      />
    );
  }

  return null;
}

// Pantalla de Evaluación
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E3F2FD',
  },
  connectionContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  historyButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  evaluateContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  evaluateHeader: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
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
    color: '#2E7D32',
  },
  statusBadge: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
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
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  criterionCardActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
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
    color: '#1565C0',
    marginBottom: 10,
  },
  criterionDescription: {
    fontSize: 15,
    color: '#555',
    marginBottom: 12,
    lineHeight: 22,
  },
  maxScoreBadge: {
    backgroundColor: '#2196F3',
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
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
    borderWidth: 3,
    elevation: 3,
    shadowColor: '#FF9800',
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
    color: '#FF9800',
  },
  rubricLevelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  rubricLevelNameSelected: {
    color: '#E65100',
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
    backgroundColor: '#FFF9C4',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
  },
  pendingCard: {
    backgroundColor: '#FFF3E0',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  pendingText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  historyHeader: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#2196F3',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#999',
  },
});
