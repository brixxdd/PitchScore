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
        
        // Unirse a la sala del totem para recibir actualizaciones
        console.log(`📡 Conectando Totem "${totemId}" a su sala...`);
        socketService.emit('totem:connect', { totemId });
        
        socketService.on('totem:connected', (data: { totemId: string }) => {
          console.log(`✅ Totem "${data.totemId}" conectado exitosamente a la sala`);
        });
        
        // Escuchar actualizaciones de equipos individuales
        socketService.on('team:updated', (team: Team) => {
          console.log('🔄 Equipo actualizado:', team.name, 'Score:', team.finalScore);
          
          setTeams((prevTeams) => {
            // Actualizar equipo específico
            const updated = prevTeams.map((t) => (t.id === team.id ? team : t));
            // Ordenar por puntaje
            const sorted = updated.sort((a, b) => b.finalScore - a.finalScore);
            
            // Verificar si hay nuevo primer lugar
            if (sorted.length > 0) {
              const currentFirstPlace = sorted[0].id;
              if (currentFirstPlace !== previousFirstPlace.current && previousFirstPlace.current !== null) {
                previousFirstPlace.current = currentFirstPlace;
                soundService.playCelebrationSound();
                console.log('🏆 ¡Nuevo primer lugar!', sorted[0].name);
              } else if (previousFirstPlace.current === null) {
                previousFirstPlace.current = currentFirstPlace;
              } else {
                soundService.playNotificationSound();
              }
            }
            
            return sorted;
          });
        });

        // Escuchar actualizaciones del ranking completo (MÁS IMPORTANTE)
        socketService.on('results:updated', (data: { teams: Team[] }) => {
          console.log('📊 Resultados completos actualizados:', data.teams.length, 'equipos');
          
          setTeams((prevTeams) => {
            // Ordenar por puntaje
            const sorted = [...data.teams].sort((a, b) => b.finalScore - a.finalScore);
            
            // Verificar si hay nuevo primer lugar
            if (sorted.length > 0) {
              const currentFirstPlace = sorted[0].id;
              const previousFirst = prevTeams.length > 0 ? prevTeams[0].id : null;
              
              if (currentFirstPlace !== previousFirst && previousFirst !== null) {
                soundService.playCelebrationSound();
                console.log('🏆 ¡Nuevo primer lugar!', sorted[0].name, 'con', sorted[0].finalScore.toFixed(2), 'puntos');
              } else if (previousFirst !== null) {
                soundService.playNotificationSound();
              }
              
              previousFirstPlace.current = currentFirstPlace;
            }
            
            return sorted;
          });
        });

        // Escuchar equipos nuevos agregados
        socketService.on('team:added', (team: Team) => {
          console.log('➕ Nuevo equipo agregado:', team.name);
          
          setTeams((prevTeams) => {
            const exists = prevTeams.some((t) => t.id === team.id);
            if (exists) {
              console.log('⚠️ Equipo ya existe, ignorando duplicado');
              return prevTeams;
            }
            return [...prevTeams, team].sort((a, b) => b.finalScore - a.finalScore);
          });
        });

        // Solicitar equipos existentes al conectar
        console.log('📡 Solicitando lista de equipos...');
        socketService.emit('team:list', { totemId });
        
        socketService.on('team:list:response', (data: { teams: Team[] }) => {
          console.log('📋 Lista de equipos recibida:', data.teams.length, 'equipos');
          const sorted = [...data.teams].sort((a, b) => b.finalScore - a.finalScore);
          setTeams(sorted);
          
          // Establecer primer lugar inicial
          if (sorted.length > 0) {
            previousFirstPlace.current = sorted[0].id;
          }
        });
      } catch (error) {
        setConnectionStatus('disconnected');
        console.error('❌ Error conectando socket:', error);
      }
    };

    connectSocket();

    // Actualizar QR cada 4 minutos (antes de que expire)
    const qrInterval = setInterval(() => {
      setQrToken(QRService.generateToken(totemId, activeTeam || undefined, activeCriterion || undefined));
    }, 4 * 60 * 1000);

    return () => {
      clearInterval(qrInterval);
      console.log('🔌 Desconectando socket...');
      socketService.disconnect();
    };
  }, [totemId]);

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

  const handleSendTeamToJudges = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    // Enviar equipo a jueces para evaluación completa
    socketService.emit('team:send-to-judges', { totemId, teamId });
    
    // Marcar localmente como enviado
    setTeams(prevTeams => 
      prevTeams.map(t => 
        t.id === teamId ? { ...t, sentToJudges: true } : t
      )
    );
    
    soundService.playNotificationSound();
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
        onSendTeamToJudges={handleSendTeamToJudges}
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
  onSendTeamToJudges,
  onChangeTeam,
  onChangeCriterion,
  onBack,
  onViewResults,
}: {
  teams: Team[];
  activeTeam: string | null;
  activeCriterion: string | null;
  onAddTeam: (name: string) => void;
  onSendTeamToJudges: (teamId: string) => void;
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
        <Text style={styles.sectionTitle}>📋 Equipos Registrados</Text>
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
            <Text style={styles.addButtonText}>➕ Agregar Equipo</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.teamsListHeader}>
          <Text style={styles.teamsListTitle}>Lista de Equipos</Text>
          <Text style={styles.teamsListSubtitle}>
            Envía equipos a jueces para evaluación completa
          </Text>
        </View>
        
        <View style={styles.teamsList}>
          {teams && teams.length > 0 ? (
            teams.map((team) => {
              if (!team || !team.id) return null;
              const isSent = team.sentToJudges === true;
              return (
                <View key={team.id} style={styles.teamItemContainer}>
                  <View
                    style={[
                      styles.teamItem,
                      isSent && styles.teamItemSent,
                    ]}
                  >
                    <View style={styles.teamItemContent}>
                      <Text style={[
                        styles.teamName,
                        isSent && styles.teamNameSent
                      ]}>
                        {team.name}
                      </Text>
                      {isSent && (
                        <Text style={styles.sentLabel}>✅ ENVIADO A JUECES</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        isSent && styles.sendButtonDisabled,
                      ]}
                      onPress={() => onSendTeamToJudges(team.id)}
                      disabled={isSent}
                    >
                      <Text style={[
                        styles.sendButtonText,
                        isSent && styles.sendButtonTextDisabled
                      ]}>
                        {isSent ? '🔒 Enviado' : '📤 Enviar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noTeamsText}>No hay equipos registrados aún</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.resultsButton} onPress={onViewResults}>
        <Text style={styles.resultsButtonText}>📊 Ver Resultados en Tiempo Real</Text>
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dotOpacity, setDotOpacity] = useState<number>(1);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  
  // Actualizar timestamp cuando cambian los equipos
  useEffect(() => {
    if (teams && teams.length > 0) {
      setLastUpdate(new Date());
      setIsUpdating(true);
      console.log('🔄 ResultsScreen actualizado con', teams.length, 'equipos');
      
      // Ocultar badge después de 2 segundos
      const timeout = setTimeout(() => {
        setIsUpdating(false);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [teams]);
  
  // Animar el punto "EN VIVO"
  useEffect(() => {
    const interval = setInterval(() => {
      setDotOpacity((prev) => (prev === 1 ? 0.3 : 1));
    }, 800);
    return () => clearInterval(interval);
  }, []);
  
  // Polling rápido para actualizaciones (cada 2 segundos)
  // Asegura que los datos estén siempre actualizados
  useEffect(() => {
    // Solicitar datos inmediatamente al abrir la pantalla
    console.log('📊 Pantalla de resultados abierta - Solicitando datos iniciales...');
    socketService.emit('team:list', { totemId: 'totem-1' });
    
    // Polling cada 2 segundos para actualizaciones en tiempo real
    const pollingInterval = setInterval(() => {
      console.log('🔄 Polling: Solicitando actualización de equipos...');
      socketService.emit('team:list', { totemId: 'totem-1' });
    }, 2000); // 2 segundos - actualizaciones muy rápidas ⚡
    
    return () => {
      clearInterval(pollingInterval);
      console.log('📊 Pantalla de resultados cerrada - Polling detenido');
    };
  }, []); // Sin dependencias, se ejecuta solo al montar/desmontar

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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.resultsTitle}>Resultados en Tiempo Real</Text>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { opacity: dotOpacity }]} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
          <Text style={styles.lastUpdateText}>
            Actualizado: {lastUpdate.toLocaleTimeString('es-ES')}
          </Text>
        </View>
      </View>

      {/* Badge de actualización */}
      {isUpdating && (
        <View style={styles.updatingBadge}>
          <Text style={styles.updatingText}>🔄 ACTUALIZANDO...</Text>
        </View>
      )}

      {/* Promedios por criterio */}
      {teams.length > 0 && (
        <View style={styles.averagesSection}>
          <View style={styles.averagesHeader}>
            <Text style={styles.averagesTitle}>Promedios por Criterio</Text>
            <Text style={styles.teamCount}>{teams.length} Equipo{teams.length !== 1 ? 's' : ''}</Text>
          </View>
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
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  lastUpdateText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontStyle: 'italic',
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
  updatingBadge: {
    backgroundColor: '#FF9800',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#F57C00',
  },
  updatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  averagesSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  averagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  averagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  teamCount: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
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
  teamsListHeader: {
    marginVertical: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  teamsListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  teamsListSubtitle: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  teamItemContainer: {
    marginBottom: 12,
  },
  teamItemContent: {
    flex: 1,
    marginRight: 10,
  },
  teamItemSent: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    opacity: 0.7,
  },
  teamNameSent: {
    color: '#2E7D32',
  },
  sentLabel: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
  },
  sendButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
    elevation: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sendButtonTextDisabled: {
    color: '#999',
  },
});
