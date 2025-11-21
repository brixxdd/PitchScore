import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'primary' | 'danger';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  buttons?: CustomAlertButton[];
  onClose?: () => void;
}

const { width } = Dimensions.get('window');

export default function CustomAlert({
  visible,
  title,
  message,
  icon = '💬',
  buttons = [{ text: 'Entendido', style: 'primary' }],
  onClose,
}: CustomAlertProps) {
  const handleButtonPress = (button: CustomAlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const getButtonGradient = (style?: string): [string, string] => {
    switch (style) {
      case 'primary':
        return ['#5dbba7', '#3a9989'];
      case 'danger':
        return ['#ff6b6b', '#ee5a52'];
      default:
        return ['#e0e0e0', '#d0d0d0'];
    }
  };

  const getButtonTextColor = (style?: string): string => {
    return style === 'default' ? '#333' : '#fff';
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{icon}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.8}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={getButtonGradient(button.style)}
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: getButtonTextColor(button.style) },
                    ]}
                  >
                    {button.text}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    width: width * 0.85,
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f9f7',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#5dbba7',
    shadowColor: '#5dbba7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    marginTop: -50,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0a2f2a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

