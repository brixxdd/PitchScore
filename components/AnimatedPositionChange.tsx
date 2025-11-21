import React from 'react';
import { View, StyleSheet } from 'react-native';

interface AnimatedPositionChangeProps {
  currentPosition: number;
  previousPosition?: number;
  children: React.ReactNode;
}

export default function AnimatedPositionChange({
  currentPosition,
  previousPosition,
  children,
}: AnimatedPositionChangeProps) {
  // Versión simplificada sin animaciones para Expo Go
  const getBackgroundColor = () => {
    if (currentPosition === 1) {
      return 'rgba(255, 215, 0, 0.2)';
    }
    if (previousPosition !== undefined && currentPosition < previousPosition) {
      return 'rgba(76, 175, 80, 0.2)';
    }
    return 'transparent';
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
  },
});

