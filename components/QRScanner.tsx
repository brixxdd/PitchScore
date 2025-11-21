import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QRToken } from '../types';
import { QRService } from '../services/qrService';

interface QRScannerProps {
  onScan: (token: QRToken) => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Se necesitan permisos de cámara</Text>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);
    const token = QRService.QRStringToToken(data);

    if (!token) {
      const errorMsg = 'QR inválido';
      Alert.alert('Error', errorMsg);
      onError?.(errorMsg);
      setTimeout(() => setScanned(false), 2000);
      return;
    }

    const validation = QRService.validateToken(token);
    if (!validation.valid) {
      Alert.alert('Error', validation.reason || 'Token inválido');
      onError?.(validation.reason || 'Token inválido');
      setTimeout(() => setScanned(false), 2000);
      return;
    }

    onScan(token);
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <Text style={styles.instruction}>
            Escanea el código QR del totem
          </Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  instruction: {
    marginTop: 30,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

