import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Team } from '../types';
import { CRITERIA } from '../config/constants';
import { socketService } from '../services/socket';
import AnimatedPositionChange from './AnimatedPositionChange';
import AnimatedScoreChange from './AnimatedScoreChange';

interface ResultsScreenProps {
  teams: Team[];
  activeTeam: string | null;
  activeCriterion: string | null;
  onBack: () => void;
}

export default function ResultsScreen({
  teams,
  activeTeam,
  activeCriterion,
  onBack,
}: ResultsScreenProps) {
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dotOpacity, setDotOpacity] = useState<number>(1);

  // Actualizar timestamp (sin indicador visual de carga)
  useEffect(() => {
    if (teams && teams.length > 0) {
      setLastUpdate(new Date());
    }
  }, [teams]);

  // Animación suave para el punto de "EN VIVO"
  useEffect(() => {
    const interval = setInterval(() => {
      setDotOpacity((prev) => (prev === 1 ? 0.4 : 1));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Polling cada 2s (se mantiene silencioso)
  useEffect(() => {
    socketService.emit('team:list', { totemId: 'totem-1' });
    const pollingInterval = setInterval(() => {
      socketService.emit('team:list', { totemId: 'totem-1' });
    }, 2000);
    return () => clearInterval(pollingInterval);
  }, []);

  const getAverageByCriterion = (criterionId: string): number => {
    if (!teams?.length) return 0;
    const scores = teams
      .map((team) => team.scores?.[criterionId] || 0)
      .filter((s) => s > 0);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  // Actualizar posiciones previas
  useEffect(() => {
    if (!teams?.length) return;
    const newPositions = new Map<string, number>();
    teams.forEach((team, idx) => {
      if (team?.id) newPositions.set(team.id, idx + 1);
    });
    previousPositionsRef.current = newPositions;
  }, [teams]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.resultsContainer}>
        {/* Header con gradiente y glassmorphism */}
        <View style={styles.headerOverlay}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.resultsTitle}>Resultados en Vivo</Text>
              <View style={styles.liveContainer}>
                <View style={[styles.liveDot, { opacity: dotOpacity }]} />
                <Text style={styles.liveText}>EN VIVO</Text>
              </View>
              <Text style={styles.lastUpdateText}>
                {lastUpdate.toLocaleTimeString('es-ES')}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </View>

      {/* Promedios por criterio */}
      {teams.length > 0 && (
        <View style={styles.averagesSection}>
          <View style={styles.averagesHeader}>
            <Text style={styles.averagesTitle}>Promedios por Criterio</Text>
            <Text style={styles.teamCount}>{teams.length} equipo{teams.length !== 1 ? 's' : ''}</Text>
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

      {/* Lista de equipos */}
      <ScrollView contentContainerStyle={styles.resultsListContent}>
        {teams.length === 0 ? (
          <Text style={styles.noResults}>No hay equipos registrados</Text>
        ) : (
          teams.map((team, index) => {
            if (!team?.id) return null;
            const previousPosition = previousPositionsRef.current.get(team.id) || index + 1;
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
                    <AnimatedScoreChange score={finalScore} isFirstPlace={index === 0} />
                    {activeCriterion && team.scores?.[activeCriterion] !== undefined && (
                      <Text style={styles.criterionScore}>
                        {CRITERIA.find((c) => c.id === activeCriterion)?.name}:{' '}
                        {team.scores[activeCriterion].toFixed(2)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f0f9f7',
  },
  headerOverlay: {
    paddingTop: 15,
    paddingHorizontal: 16,
    paddingBottom: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 70, // Mismo ancho que el botón de volver para centrar el contenido
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 10,
    width: 70,
  },
  backButtonText: {
    color: '#0a2f2a',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a2f2a',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
    marginRight: 8,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  liveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a2f2a',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#5dbba7',
    fontWeight: '600',
  },

  averagesSection: {
    marginHorizontal: 16,
    marginVertical: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(93, 187, 167, 0.3)',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  averagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  averagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a2f2a',
  },
  teamCount: {
    fontSize: 13,
    color: '#5dbba7',
    fontWeight: '600',
  },
  averagesList: {
    flexDirection: 'row',
  },
  averageItem: {
    backgroundColor: 'rgba(245, 253, 252, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(93, 187, 167, 0.2)',
  },
  averageLabel: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    marginBottom: 5,
    lineHeight: 14,
  },
  averageValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0a2f2a',
  },

  resultsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  noResults: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 50,
    fontStyle: 'italic',
  },
  resultItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(93, 187, 167, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  firstPlace: {
    backgroundColor: 'rgba(255, 250, 230, 0.85)',
    borderColor: '#ffd700',
    borderWidth: 2,
    shadowColor: '#ffd700',
    shadowOpacity: 0.2,
    elevation: 6,
  },
  activeTeam: {
    borderColor: '#5dbba7',
    borderWidth: 2,
    backgroundColor: 'rgba(240, 250, 248, 0.85)',
  },
  positionBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5dbba7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  positionText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  teamInfo: {
    flex: 1,
  },
  teamNameResult: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a2f2a',
    marginBottom: 5,
  },
  criterionScore: {
    fontSize: 13,
    color: '#555',
    marginTop: 3,
    fontWeight: '500',
  },
});