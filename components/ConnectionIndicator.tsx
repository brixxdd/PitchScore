import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
}

export default function ConnectionIndicator({
  status,
  showLabel = true,
}: ConnectionIndicatorProps) {
  // Versión simplificada sin animaciones para Expo Go

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#F44336';
      case 'connecting':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'connecting':
        return 'Conectando...';
      default:
        return 'Desconocido';
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.indicator,
          { backgroundColor: getStatusColor() },
          status === 'connecting' && styles.connectingIndicator,
        ]}
      />
      {showLabel && (
        <Text style={styles.label}>{getStatusLabel()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  connectingIndicator: {
    opacity: 0.7,
  },
});

