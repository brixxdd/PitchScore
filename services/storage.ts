import AsyncStorage from '@react-native-async-storage/async-storage';
import { Team, Evaluation } from '../types';

const STORAGE_KEYS = {
  JUDGE_ID: '@pitchscore:judgeId',
  TOTEM_ID: '@pitchscore:totemId',
  TEAMS: '@pitchscore:teams',
  EVALUATIONS: '@pitchscore:evaluations',
} as const;

export class StorageService {
  // Judge ID
  static async saveJudgeId(judgeId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.JUDGE_ID, judgeId);
  }

  static async getJudgeId(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.JUDGE_ID);
  }

  static async removeJudgeId(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.JUDGE_ID);
  }

  // Totem ID
  static async saveTotemId(totemId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TOTEM_ID, totemId);
  }

  static async getTotemId(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.TOTEM_ID);
  }

  // Teams Cache
  static async saveTeams(teams: Team[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
  }

  static async getTeams(): Promise<Team[] | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TEAMS);
    return data ? JSON.parse(data) : null;
  }

  // Evaluations Cache
  static async saveEvaluations(evaluations: Evaluation[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
  }

  static async getEvaluations(): Promise<Evaluation[] | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EVALUATIONS);
    return data ? JSON.parse(data) : null;
  }

  static async addEvaluation(evaluation: Evaluation): Promise<void> {
    const existing = await this.getEvaluations() || [];
    existing.push(evaluation);
    await this.saveEvaluations(existing);
  }

  // Clear all
  static async clearAll(): Promise<void> {
    const keys = [
      STORAGE_KEYS.JUDGE_ID,
      STORAGE_KEYS.TOTEM_ID,
      STORAGE_KEYS.TEAMS,
      STORAGE_KEYS.EVALUATIONS,
    ];
    await AsyncStorage.multiRemove(keys);
  }
}

