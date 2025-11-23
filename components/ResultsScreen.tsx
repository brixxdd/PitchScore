import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// import Animated, { FadeInDown, Layout, FadeIn } from 'react-native-reanimated';
// @ts-ignore
import * as Print from 'expo-print';
// @ts-ignore
import * as Sharing from 'expo-sharing';
import { Team } from '../types';
import { CRITERIA } from '../config/constants';
import { socketService, SERVER_URL } from '../services/socket';
import AnimatedScoreChange from './AnimatedScoreChange';

interface ResultsScreenProps {
  teams: Team[];
  activeTeam: string | null;
  activeCriterion: string | null;
  onBack: () => void;
}

const { width } = Dimensions.get('window');

export default function ResultsScreen({
  teams,
  activeTeam,
  activeCriterion,
  onBack,
}: ResultsScreenProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Actualizar timestamp
  useEffect(() => {
    if (teams && teams.length > 0) {
      setLastUpdate(new Date());
    }
  }, [teams]);

  // Polling cada 2s
  useEffect(() => {
    socketService.emit('team:list', { totemId: 'totem-1' });
    const pollingInterval = setInterval(() => {
      socketService.emit('team:list', { totemId: 'totem-1' });
    }, 2000);
    return () => clearInterval(pollingInterval);
  }, []);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`${SERVER_URL}/api/debug/evaluations`);
      const data = await response.json();
      const html = generatePDFHTML(data, teams);
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Reporte de Evaluaciones - PitchScore',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('✅ PDF Generado', `PDF guardado en: ${uri}`);
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      Alert.alert('❌ Error', 'No se pudo generar el reporte PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Separar Top 3 y el resto
  const top3 = teams.slice(0, 3);
  const restOfTeams = teams.slice(3);

  const renderPodiumItem = (team: Team, rank: number) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;

    let gradientColors: [string, string, ...string[]] = ['#f0f0f0', '#e0e0e0'];
    let borderColor = '#ccc';
    let scale = 0.9;
    let translateY = 0;

    if (isFirst) {
      gradientColors = ['#FFD700', '#FDB931']; // Gold
      borderColor = '#B8860B';
      scale = 1.1;
      translateY = -20;
    } else if (isSecond) {
      gradientColors = ['#E0E0E0', '#B0B0B0']; // Silver
      borderColor = '#A9A9A9';
      scale = 1.0;
      translateY = 0;
    } else if (isThird) {
      gradientColors = ['#CD7F32', '#8B4513']; // Bronze
      borderColor = '#8B4513';
      scale = 0.95;
      translateY = 10;
    }

    return (
      <View
        key={team.id}
        style={[
          styles.podiumCard,
          { transform: [{ scale }, { translateY }] }
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          style={[styles.podiumGradient, { borderColor }]}
        >
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
          <Text style={styles.podiumTeamName} numberOfLines={2}>
            {team.name}
          </Text>
          <View style={styles.scoreContainer}>
            <Text style={styles.podiumScoreLabel}>Puntaje</Text>
            <Text style={styles.podiumScore}>{team.finalScore.toFixed(2)}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a2f2a', '#1a4f4a']}
        style={styles.headerBackground}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>🏆 Tabla de Posiciones</Text>
            <Text style={styles.subtitle}>Resultados en Tiempo Real</Text>
          </View>
          <TouchableOpacity
            onPress={handleExportPDF}
            style={styles.exportButton}
            disabled={isExporting || teams.length === 0}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportButtonText}>📄</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Podium Section */}
          {teams.length > 0 && (
            <View style={styles.podiumContainer}>
              {/* Render order: 2nd, 1st, 3rd for visual pyramid */}
              {top3.length >= 2 && renderPodiumItem(top3[1], 2)}
              {top3.length >= 1 && renderPodiumItem(top3[0], 1)}
              {top3.length >= 3 && renderPodiumItem(top3[2], 3)}
            </View>
          )}

          {/* List Section */}
          <View style={styles.listContainer}>
            {restOfTeams.map((team, index) => (
              <View
                key={team.id}
                style={styles.listItem}
              >
                <View style={styles.listRank}>
                  <Text style={styles.listRankText}>{index + 4}</Text>
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listTeamName}>{team.name}</Text>
                  {activeCriterion && team.scores?.[activeCriterion] !== undefined && (
                    <Text style={styles.criterionScore}>
                      {CRITERIA.find((c) => c.id === activeCriterion)?.name}: {team.scores[activeCriterion].toFixed(2)}
                    </Text>
                  )}
                </View>
                <View style={styles.listScore}>
                  <AnimatedScoreChange score={team.finalScore} isFirstPlace={false} />
                </View>
              </View>
            ))}
          </View>

          {teams.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Esperando equipos...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Generar HTML para el PDF
const generatePDFHTML = (data: any, teams: Team[]) => {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  const hora = now.toLocaleTimeString('es-ES');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #0a2f2a;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #5dbba7;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #5dbba7;
            margin: 0;
            font-size: 32px;
          }
          .header .subtitle {
            color: #666;
            margin-top: 5px;
            font-size: 14px;
          }
          .summary {
            background: #f0f9f7;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .summary-item {
            display: inline-block;
            margin-right: 30px;
            font-weight: bold;
          }
          .team-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .team-header {
            background: #5dbba7;
            color: white;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: bold;
          }
          .position-badge {
            background: #0a2f2a;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            margin-left: 10px;
          }
          .final-score {
            float: right;
            background: white;
            color: #5dbba7;
            padding: 4px 15px;
            border-radius: 20px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th {
            background: #e8f5f2;
            padding: 10px;
            text-align: left;
            border: 1px solid #d0e9e3;
            font-size: 12px;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e0e0e0;
            font-size: 11px;
          }
          .criterion-name {
            font-weight: bold;
            color: #0a2f2a;
          }
          .judge-score {
            text-align: center;
            font-weight: 600;
          }
          .total-row {
            background: #fff9e6;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #999;
            font-size: 11px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .first-place {
            border: 3px solid #ffd700;
            background: #fffbf0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎯 PitchScore - Reporte de Evaluaciones</h1>
          <div class="subtitle">
            Generado el ${fecha} a las ${hora}
          </div>
        </div>

        <div class="summary">
          <span class="summary-item">📊 Total de Equipos: ${data.totalTeams}</span>
          <span class="summary-item">⚖️ Total de Jueces: ${data.totalJudges}</span>
          <span class="summary-item">📝 Total de Evaluaciones: ${data.totalEvaluations}</span>
        </div>

        ${teams.map((team, index) => {
          const evaluations = data.evaluationsByTeam[team.id] || [];
          const juecesUnicos = [...new Set(evaluations.map((e: any) => e.judgeId))];
          
          // Agrupar por criterio
          const porCriterio: any = {};
          CRITERIA.forEach(criterion => {
            porCriterio[criterion.id] = {
              name: criterion.name,
              scores: juecesUnicos.map(judgeId => {
                const eval_found = evaluations.find((e: any) => 
                  e.criterionId === criterion.id && e.judgeId === judgeId
                );
                return eval_found ? eval_found.score : 0;
              }),
              total: 0
            };
            porCriterio[criterion.id].total = porCriterio[criterion.id].scores.reduce((a: number, b: number) => a + b, 0);
          });

          return `
            <div class="team-section ${index === 0 ? 'first-place' : ''}">
              <div class="team-header">
                <span class="position-badge">#${index + 1}</span>
                ${team.name}
                <span class="final-score">${team.finalScore.toFixed(2)} pts</span>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Criterio</th>
                    ${juecesUnicos.map((judgeId, idx) => `
                      <th style="text-align: center;">Juez ${idx + 1}</th>
                    `).join('')}
                    <th style="text-align: center; background: #5dbba7; color: white;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${CRITERIA.map(criterion => {
                    const datos = porCriterio[criterion.id];
                    return `
                      <tr>
                        <td class="criterion-name">${criterion.name}</td>
                        ${datos.scores.map((score: number) => `
                          <td class="judge-score">${score > 0 ? score : '-'}</td>
                        `).join('')}
                        <td class="judge-score" style="background: #e8f5f2; font-weight: bold;">
                          ${datos.total}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="total-row">
                    <td><strong>TOTAL</strong></td>
                    ${juecesUnicos.map(judgeId => {
                      const totalJuez = CRITERIA.reduce((sum, criterion) => {
                        const eval_found = evaluations.find((e: any) => 
                          e.criterionId === criterion.id && e.judgeId === judgeId
                        );
                        return sum + (eval_found ? eval_found.score : 0);
                      }, 0);
                      return `<td class="judge-score">${totalJuez}</td>`;
                    }).join('')}
                    <td class="judge-score" style="background: #5dbba7; color: white;">
                      <strong>${team.finalScore.toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <div class="footer">
          PitchScore - Sistema de Evaluación para Concursos<br>
          Este reporte es confidencial y solo debe ser usado para fines oficiales del concurso.
        </div>
      </body>
    </html>
  `;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f3',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  exportButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 280,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  podiumCard: {
    width: width * 0.28,
    height: 180,
    marginHorizontal: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  podiumGradient: {
    flex: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
  },
  rankBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  rankText: {
    fontWeight: 'bold',
    color: '#333',
  },
  podiumTeamName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 5,
  },
  scoreContainer: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  podiumScoreLabel: {
    fontSize: 10,
    color: '#555',
  },
  podiumScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f4f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  listRankText: {
    fontWeight: 'bold',
    color: '#5dbba7',
  },
  listInfo: {
    flex: 1,
  },
  listTeamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  criterionScore: {
    fontSize: 12,
    color: '#666',
  },
  listScore: {
    alignItems: 'flex-end',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    opacity: 0.8,
  },
});