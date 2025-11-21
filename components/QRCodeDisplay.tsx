import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { QRToken } from '../types';
import { QRService } from '../services/qrService';

interface QRCodeDisplayProps {
  token: QRToken;
  size?: number;
  showLabel?: boolean;
}

export default function QRCodeDisplay({
  token,
  size = 200,
  showLabel = true,
}: QRCodeDisplayProps) {
  const qrString = QRService.tokenToQRString(token);
  const isExpired = QRService.isTokenExpired(token);

  if (isExpired) {
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>QR Expirado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <QRCode
        value={qrString}
        size={size}
        color="#000000"
        backgroundColor="#FFFFFF"
      />
      {showLabel && (
        <Text style={styles.label}>
          Escanea para conectar
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  expiredText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '600',
  },
});

