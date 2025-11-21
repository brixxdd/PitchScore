import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, SafeAreaView } from 'react-native';
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

// Panel de Administración
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

      {/* Botón de Reset */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerZoneTitle}>⚠️ Zona Peligrosa</Text>
        <Text style={styles.dangerZoneSubtitle}>
          Resetear eliminará TODOS los datos (equipos, evaluaciones, jueces)
        </Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setShowResetModal(true)}
        >
          <Text style={styles.resetButtonText}>🗑️ RESETEAR SISTEMA</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Confirmación de Reset */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔒 Resetear Sistema</Text>
            <Text style={styles.modalDescription}>
              Esta acción eliminará permanentemente:
              {'\n'}• Todos los equipos
              {'\n'}• Todas las evaluaciones
              {'\n'}• Todos los jueces
              {'\n'}• Configuraciones del totem
              {'\n\n'}⚠️ Esta acción NO se puede deshacer
            </Text>
            
            <Text style={styles.modalLabel}>Ingresa la contraseña:</Text>
            <TextInput
              style={styles.modalInput}
              value={resetPassword}
              onChangeText={setResetPassword}
              placeholder="Contraseña"
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
                <Text style={styles.modalConfirmButtonText}>Confirmar Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    backgroundColor: '#e8f5f2',
  },
  adminHeader: {
    backgroundColor: '#5dbba7',
    padding: 25,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  adminTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
    letterSpacing: 1,
  },
  backButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 25,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#5dbba7',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0a2f2a',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 17,
    color: '#0a2f2a',
    marginBottom: 12,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#f8fcfb',
    borderWidth: 2,
    borderColor: '#a0d9cd',
    borderRadius: 12,
    padding: 15,
    fontSize: 17,
    color: '#0a2f2a',
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#5dbba7',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  addButtonDisabled: {
    backgroundColor: '#bbb',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  teamsList: {
    marginTop: 15,
  },
  teamItem: {
    backgroundColor: '#f8fcfb',
    padding: 18,
    borderRadius: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0f2ee',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  teamItemActive: {
    backgroundColor: '#e0f7f3',
    borderWidth: 3,
    borderColor: '#5dbba7',
    shadowOpacity: 0.25,
    elevation: 4,
  },
  teamName: {
    fontSize: 18,
    color: '#0a2f2a',
    fontWeight: 'bold',
  },
  activeLabel: {
    fontSize: 13,
    color: '#5dbba7',
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
  connectionContainer: {
    marginTop: 15,
    alignItems: 'center',
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
    backgroundColor: '#5dbba7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
  dangerZone: {
    backgroundColor: '#ffe6e6',
    margin: 15,
    padding: 25,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#ff6b6b',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  dangerZoneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 8,
  },
  dangerZoneSubtitle: {
    fontSize: 13,
    color: '#D32F2F',
    marginBottom: 15,
    lineHeight: 18,
  },
  resetButton: {
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#D32F2F',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#FFCDD2',
    opacity: 0.5,
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
