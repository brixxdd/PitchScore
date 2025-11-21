import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import * as SystemUI from 'expo-system-ui';
import { useRouter } from 'expo-router';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import { QRService } from '../../services/qrService';
import { QRToken, Team, Criterion } from '../../types';
import { CRITERIA } from '../../config/constants';
import { socketService } from '../../services/socket';
import AnimatedPositionChange from '../../components/AnimatedPositionChange';
import AnimatedScoreChange from '../../components/AnimatedScoreChange';
import ConnectionIndicator from '../../components/ConnectionIndicator';
import { soundService } from '../../services/soundService';

type Screen = 'welcome' | 'admin' | 'results';

export default function TotemScreen() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [totemId] = useState('totem-1');
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [previousPositions, setPreviousPositions] = useState<Map<string, number>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [qrToken, setQrToken] = useState<QRToken>(
    QRService.generateToken(totemId)
  );
  const previousFirstPlace = useRef<string | null>(null);

  useEffect(() => {
    // Activar modo kiosko - pantalla completa
    SystemUI.setBackgroundColorAsync('#000000');
    
    // Inicializar servicio de sonido
    soundService.initialize();

    // Conectar socket
    const connectSocket = async () => {
      setConnectionStatus('connecting');
      const SERVER_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        await socketService.connect(SERVER_URL);
        setConnectionStatus('connected');
        
        // Escuchar actualizaciones de equipos
        socketService.on('team:updated', (team: Team) => {
          setTeams((prev) => {
            // Guardar posiciones anteriores
            const prevPositions = new Map<string, number>();
            prev.forEach((t, idx) => prevPositions.set(t.id, idx + 1));
            setPreviousPositions(prevPositions);

            const updated = prev.map((t) => (t.id === team.id ? team : t));
            const sorted = updated.sort((a, b) => b.finalScore - a.finalScore);
            
            // Verificar si hay nuevo primer lugar
            if (sorted.length > 0 && sorted[0].id !== previousFirstPlace.current) {
              previousFirstPlace.current = sorted[0].id;
              soundService.playCelebrationSound();
            } else {
              soundService.playNotificationSound();
            }
            
            return sorted;
          });
        });

        socketService.on('results:updated', (data: { teams: Team[] }) => {
          const sorted = data.teams.sort((a, b) => b.finalScore - a.finalScore);
          setTeams(sorted);
        });

        socketService.on('team:added', (team: Team) => {
          setTeams((prev) => {
            const exists = prev.some((t) => t.id === team.id);
            if (exists) return prev;
            return [...prev, team];
          });
        });

        // Solicitar equipos existentes al conectar
        socketService.emit('team:list', { totemId });
        socketService.on('team:list:response', (data: { teams: Team[] }) => {
          setTeams(data.teams);
        });
      } catch (error) {
        setConnectionStatus('disconnected');
        console.error('Error conectando socket:', error);
      }
    };

    connectSocket();

    // Actualizar QR cada 4 minutos (antes de que expire)
    const qrInterval = setInterval(() => {
      setQrToken(QRService.generateToken(totemId, activeTeam || undefined, activeCriterion || undefined));
    }, 4 * 60 * 1000);

    return () => {
      clearInterval(qrInterval);
      socketService.disconnect();
    };
  }, [totemId, activeTeam, activeCriterion]);

  // Actualizar QR cuando cambia equipo o criterio
  useEffect(() => {
    setQrToken(QRService.generateToken(totemId, activeTeam || undefined, activeCriterion || undefined));
  }, [activeTeam, activeCriterion, totemId]);

  const handleAddTeam = (teamName: string) => {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: teamName,
      totemId,
      scores: {},
      finalScore: 0,
      positionHistory: [],
    };
    
    // Enviar al backend
    socketService.emit('team:add', newTeam);
    
    // Agregar localmente (se actualizará cuando el backend confirme)
    setTeams([...teams, newTeam]);
  };

  const handleChangeTeam = (teamId: string) => {
    setActiveTeam(teamId);
    socketService.emit('totem:change-team', { totemId, teamId });
  };

  const handleChangeCriterion = (criterionId: string) => {
    setActiveCriterion(criterionId);
    socketService.emit('totem:change-criterion', { totemId, criterionId });
  };

  if (currentScreen === 'welcome') {
    return (
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeTitle}>PitchScore</Text>
        <Text style={styles.welcomeSubtitle}>Modo Totem - Kiosko</Text>
        
        <View style={styles.qrContainer}>
          <Text style={styles.qrLabel}>QR para Conexión de Jueces</Text>
          <QRCodeDisplay token={qrToken} size={250} />
          <View style={styles.connectionContainer}>
            <ConnectionIndicator status={connectionStatus} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => setCurrentScreen('admin')}
        >
          <Text style={styles.adminButtonText}>Panel de Administración</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resultsButton}
          onPress={() => setCurrentScreen('results')}
        >
          <Text style={styles.resultsButtonText}>Ver Resultados</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'admin') {
    return (
      <AdminPanel
        teams={teams}
        activeTeam={activeTeam}
        activeCriterion={activeCriterion}
        onAddTeam={handleAddTeam}
        onChangeTeam={handleChangeTeam}
        onChangeCriterion={handleChangeCriterion}
        onBack={() => setCurrentScreen('welcome')}
        onViewResults={() => setCurrentScreen('results')}
      />
    );
  }

  if (currentScreen === 'results') {
    return (
      <ResultsScreen
        teams={teams}
        activeTeam={activeTeam}
        activeCriterion={activeCriterion}
        onBack={() => setCurrentScreen('welcome')}
      />
    );
  }

  return null;
}

// Panel de Administración
function AdminPanel({
  teams,
  activeTeam,
  activeCriterion,
  onAddTeam,
  onChangeTeam,
  onChangeCriterion,
  onBack,
  onViewResults,
}: {
  teams: Team[];
  activeTeam: string | null;
  activeCriterion: string | null;
  onAddTeam: (name: string) => void;
  onChangeTeam: (teamId: string) => void;
  onChangeCriterion: (criterionId: string) => void;
  onBack: () => void;
  onViewResults: () => void;
}) {
  const [newTeamName, setNewTeamName] = useState('');

  return (
    <ScrollView style={styles.adminContainer}>
      <View style={styles.adminHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.adminTitle}>Panel de Administración</Text>
      </View>

      {/* Registrar Equipos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registrar Equipos</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nombre del Equipo:</Text>
          <TextInput
            style={styles.textInput}
            value={newTeamName}
            onChangeText={setNewTeamName}
            placeholder="Ingresa el nombre del equipo"
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[styles.addButton, !newTeamName.trim() && styles.addButtonDisabled]}
            onPress={() => {
              if (newTeamName.trim()) {
                onAddTeam(newTeamName.trim());
                setNewTeamName('');
              }
            }}
            disabled={!newTeamName.trim()}
          >
            <Text style={styles.addButtonText}>Agregar Equipo</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.teamsList}>
          {teams && teams.length > 0 ? (
            teams.map((team) => {
              if (!team || !team.id) return null;
              return (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamItem,
                    activeTeam === team.id && styles.teamItemActive,
                  ]}
                  onPress={() => onChangeTeam(team.id)}
                >
                  <Text style={styles.teamName}>{team.name}</Text>
                  {activeTeam === team.id && (
                    <Text style={styles.activeLabel}>ACTIVO</Text>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noTeamsText}>No hay equipos registrados aún</Text>
          )}
        </View>
      </View>

      {/* Seleccionar Criterio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Criterio de Evaluación</Text>
        <View style={styles.criteriaList}>
          {CRITERIA.map((criterion) => (
            <TouchableOpacity
              key={criterion.id}
              style={[
                styles.criterionItem,
                activeCriterion === criterion.id && styles.criterionItemActive,
              ]}
              onPress={() => onChangeCriterion(criterion.id)}
            >
              <Text style={styles.criterionName}>{criterion.name}</Text>
              {activeCriterion === criterion.id && (
                <Text style={styles.activeLabel}>ACTIVO</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.resultsButton} onPress={onViewResults}>
        <Text style={styles.resultsButtonText}>Ver Resultados en Tiempo Real</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Pantalla de Resultados
function ResultsScreen({
  teams,
  activeTeam,
  activeCriterion,
  onBack,
}: {
  teams: Team[];
  activeTeam: string | null;
  activeCriterion: string | null;
  onBack: () => void;
}) {
  const previousPositionsRef = useRef<Map<string, number>>(new Map());

  // Calcular promedio por criterio
  const getAverageByCriterion = (criterionId: string): number => {
    if (!teams || teams.length === 0) return 0;
    
    const scores = teams
      .filter((team) => team && team.scores) // Validar que team y scores existen
      .map((team) => team.scores[criterionId] || 0)
      .filter((score) => score > 0);
    
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  // Actualizar posiciones anteriores
  useEffect(() => {
    if (!teams || teams.length === 0) return;
    
    const newPositions = new Map<string, number>();
    teams.forEach((team, index) => {
      if (team && team.id) {
        newPositions.set(team.id, index + 1);
      }
    });
    previousPositionsRef.current = newPositions;
  }, [teams]);

  return (
    <View style={styles.resultsContainer}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.resultsTitle}>Resultados en Tiempo Real</Text>
      </View>

      {/* Promedios por criterio */}
      {teams.length > 0 && (
        <View style={styles.averagesSection}>
          <Text style={styles.averagesTitle}>Promedios por Criterio</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.averagesList}>
            {CRITERIA.map((criterion) => {
              const avg = getAverageByCriterion(criterion.id);
              return (
                <View key={criterion.id} style={styles.averageItem}>
                  <Text style={styles.averageLabel} numberOfLines={2}>
                    {criterion.name}
                  </Text>
                  <Text style={styles.averageValue}>{avg.toFixed(2)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.resultsList}>
        {teams.length === 0 ? (
          <Text style={styles.noResults}>No hay equipos registrados</Text>
        ) : (
          teams.map((team, index) => {
            // Validar que el equipo tiene datos válidos
            if (!team || !team.id) return null;
            
            const previousPosition = previousPositionsRef.current.get(team.id) || index + 1;
            const teamScores = team.scores || {};
            const finalScore = team.finalScore || 0;
            
            return (
              <AnimatedPositionChange
                key={team.id}
                currentPosition={index + 1}
                previousPosition={previousPosition}
              >
                <View
                  style={[
                    styles.resultItem,
                    index === 0 && styles.firstPlace,
                    activeTeam === team.id && styles.activeTeam,
                  ]}
                >
                  <View style={styles.positionBadge}>
                    <Text style={styles.positionText}>{index + 1}</Text>
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamNameResult}>{team.name || 'Sin nombre'}</Text>
                    <AnimatedScoreChange
                      score={finalScore}
                      isFirstPlace={index === 0}
                    />
                    {activeCriterion && teamScores[activeCriterion] !== undefined && (
                      <Text style={styles.criterionScore}>
                        {CRITERIA.find((c) => c.id === activeCriterion)?.name}:{' '}
                        {teamScores[activeCriterion].toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </AnimatedPositionChange>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 20,
    color: '#ccc',
    marginBottom: 40,
  },
  qrContainer: {
    backgroundColor: '#1a1a1a',
    padding: 30,
    borderRadius: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    fontWeight: '600',
  },
  adminButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    marginBottom: 15,
    alignItems: 'center',
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  resultsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  adminContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  adminHeader: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminTitle: {
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
  section: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  teamsList: {
    marginTop: 10,
  },
  teamItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamItemActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  teamName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  activeLabel: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  criteriaList: {
    marginTop: 10,
  },
  criterionItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  criterionItemActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  criterionName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  resultsHeader: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  resultsList: {
    flex: 1,
    padding: 15,
  },
  noResults: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  resultItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  firstPlace: {
    backgroundColor: '#FFF9C4',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  activeTeam: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  positionBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  positionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamInfo: {
    flex: 1,
  },
  teamNameResult: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  scoreText: {
    fontSize: 16,
    color: '#666',
  },
  connectionContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  averagesSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  averagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  averagesList: {
    flexDirection: 'row',
  },
  averageItem: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  averageLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  averageValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  criterionScore: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 5,
    fontWeight: '600',
  },
  noTeamsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
});
