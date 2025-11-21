import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AnimatedScoreChangeProps {
  score: number;
  previousScore?: number;
  isFirstPlace?: boolean;
}

export default function AnimatedScoreChange({
  score,
  previousScore,
  isFirstPlace = false,
}: AnimatedScoreChangeProps) {
  // Versión simplificada sin animaciones para Expo Go
  return (
    <View style={styles.container}>
      <Text style={[styles.score, isFirstPlace && styles.firstPlaceScore]}>
        {score.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  firstPlaceScore: {
    color: '#FFD700',
    fontSize: 28,
  },
});

