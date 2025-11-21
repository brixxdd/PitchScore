import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
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
import ResultsScreen from '../../components/ResultsScreen';
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

  const handleResetData = (password: string) => {
    const CORRECT_PASSWORD = 'unachnegocios';

    if (password !== CORRECT_PASSWORD) {
      Alert.alert('❌ Contraseña Incorrecta', 'La contraseña ingresada no es correcta.');
      return false;
    }

    // Emitir evento para resetear datos en el servidor
    socketService.emit('system:reset-data', { password, totemId });

    // Escuchar confirmación
    socketService.on('system:reset-success', () => {
      // Limpiar estado local
      setTeams([]);
      setActiveTeam(null);
      setActiveCriterion(null);

      soundService.playNotificationSound();
      Alert.alert(
        '✅ Datos Reseteados',
        'Todos los datos han sido eliminados exitosamente. El sistema está listo para un nuevo evento.',
        [{ text: 'Entendido' }]
      );
    });

    socketService.on('system:reset-error', (data: { error: string }) => {
      Alert.alert('❌ Error', `No se pudieron resetear los datos: ${data.error}`);
    });

    return true;
  };

  if (currentScreen === 'welcome') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>PitchScore</Text>
          <Text style={styles.welcomeSubtitle}>Modo Totem - Kiosko</Text>

          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>QR para Conexión de Jueces</Text>
            <QRCodeDisplay token={qrToken} size={180} />
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
      </SafeAreaView>
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
        onResetData={handleResetData}
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


function AdminPanel({
  teams,
  activeTeam,
  activeCriterion,
  onAddTeam,
  onSendTeamToJudges,
  onChangeTeam,
  onChangeCriterion,
  onResetData,
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
  onResetData: (password: string) => boolean;
  onBack: () => void;
  onViewResults: () => void;
}) {
  const [newTeamName, setNewTeamName] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const handleConfirmReset = () => {
    const success = onResetData(resetPassword);
    if (success) {
      setShowResetModal(false);
      setResetPassword('');
    }
  };

  return (
    <View style={styles.adminContainer}>
      <LinearGradient
        colors={['#0a2f2a', '#1a4f4a']}
        style={styles.adminHeaderGradient}
      >
        <SafeAreaView>
          <View style={styles.adminHeaderContent}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.adminTitle}>Panel de Administración</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.adminScrollView} contentContainerStyle={styles.adminScrollContent}>
        {/* Registrar Equipos */}
        <View
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Registrar Nuevo Equipo</Text>
            <Text style={styles.sectionSubtitle}>Agrega equipos a la competencia</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={newTeamName}
              onChangeText={setNewTeamName}
              placeholder="Nombre del equipo..."
              placeholderTextColor="#88a"
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
              <LinearGradient
                colors={newTeamName.trim() ? ['#5dbba7', '#3a9989'] : ['#ccc', '#bbb']}
                style={styles.addButtonGradient}
              >
                <Text style={styles.addButtonText}>Agregar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={styles.section}
        >
          <View style={styles.teamsListHeader}>
            <Text style={styles.teamsListTitle}>Equipos en Competencia</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{teams.length} Equipos</Text>
            </View>
          </View>

          <View style={styles.teamsList}>
            {teams && teams.length > 0 ? (
              teams.map((team, index) => {
                if (!team || !team.id) return null;
                const isSent = team.sentToJudges === true;
                return (
                  <View
                    key={team.id}
                    style={styles.teamItemContainer}
                  >
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
                          <View style={styles.sentBadge}>
                            <Text style={styles.sentBadgeText}>EN EVALUACIÓN</Text>
                          </View>
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
                        <LinearGradient
                          colors={isSent ? ['#e0e0e0', '#d0d0d0'] : ['#5dbba7', '#3a9989']}
                          style={styles.sendButtonGradient}
                        >
                          <Text style={[
                            styles.sendButtonText,
                            isSent && styles.sendButtonTextDisabled
                          ]}>
                            {isSent ? 'Enviado' : 'Evaluar'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No hay equipos registrados</Text>
                <Text style={styles.emptyStateSubtext}>Agrega el primer equipo arriba</Text>
              </View>
            )}
          </View>
        </View>

        <View>
          <TouchableOpacity style={styles.resultsButtonCard} onPress={onViewResults}>
            <LinearGradient
              colors={['#3a9989', '#2d7a6d']}
              style={styles.resultsButtonGradient}
            >
              <Text style={styles.resultsButtonCardText}>📊 Ver Resultados en Tiempo Real</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Botón de Reset */}
        <View style={styles.dangerZone}>
          <View style={styles.dangerHeader}>
            <Text style={styles.dangerZoneTitle}>Zona de Peligro</Text>
          </View>
          <Text style={styles.dangerZoneSubtitle}>
            Esta acción eliminará todos los datos del evento actual.
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setShowResetModal(true)}
          >
            <Text style={styles.resetButtonText}>RESETEAR SISTEMA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Confirmación de Reset */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🗑️</Text>
              <Text style={styles.modalTitle}>Resetear Sistema</Text>
            </View>
            <Text style={styles.modalDescription}>
              Esta acción es irreversible. Se eliminarán:
              {'\n'}• Todos los equipos
              {'\n'}• Todas las evaluaciones
              {'\n'}• Historial de puntajes
            </Text>

            <TextInput
              style={styles.modalInput}
              value={resetPassword}
              onChangeText={setResetPassword}
              placeholder="Contraseña de administrador"
              placeholderTextColor="#999"
              secureTextEntry={true}
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowResetModal(false);
                  setResetPassword('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !resetPassword && styles.modalConfirmButtonDisabled
                ]}
                onPress={handleConfirmReset}
                disabled={!resetPassword}
              >
                <LinearGradient
                  colors={!resetPassword ? ['#ccc', '#bbb'] : ['#ff6b6b', '#e05252']}
                  style={styles.modalConfirmGradient}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirmar Reset</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a2f2a',
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#0a2f2a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#5dbba7',
    marginBottom: 10,
    textShadowColor: 'rgba(93, 187, 167, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  welcomeSubtitle: {
    fontSize: 22,
    color: '#a0d9cd',
    marginBottom: 50,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 25,
    borderRadius: 20,
    marginBottom: 30,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#5dbba7',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  qrLabel: {
    fontSize: 18,
    color: '#0a2f2a',
    marginBottom: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  adminButton: {
    backgroundColor: '#5dbba7',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    maxWidth: 300,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  resultsButton: {
    backgroundColor: '#3a9989',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#5dbba7',
    shadowColor: '#3a9989',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  resultsButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  adminContainer: {
    flex: 1,
    backgroundColor: '#f0f4f3',
  },
  adminHeaderGradient: {
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  adminHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  adminTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 15,
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  adminScrollView: {
    flex: 1,
  },
  adminScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a4f4a',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f8f7',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  teamsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  teamsListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badgeContainer: {
    backgroundColor: '#e0f2f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#00796b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamsList: {
    gap: 12,
  },
  teamItemContainer: {
    marginBottom: 4,
  },
  teamItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  teamItemSent: {
    backgroundColor: '#f9fcfb',
    borderColor: '#e0f2f1',
  },
  teamItemContent: {
    flex: 1,
    marginRight: 12,
  },
  teamName: {
    fontSize: 17,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  teamNameSent: {
    color: '#555',
  },
  sentBadge: {
    backgroundColor: '#e8f5e9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sentBadgeText: {
    fontSize: 10,
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 90,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: '#666',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  resultsButtonCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#3a9989',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resultsButtonGradient: {
    padding: 20,
    alignItems: 'center',
  },
  resultsButtonCardText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  dangerZone: {
    backgroundColor: '#fff0f0',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dangerZoneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  dangerZoneSubtitle: {
    fontSize: 14,
    color: '#b71c1c',
    marginBottom: 16,
    opacity: 0.8,
  },
  resetButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef5350',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#d32f2f',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 15,
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalConfirmButtonDisabled: {
    opacity: 0.7,
  },
  connectionContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
});
