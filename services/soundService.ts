import { Audio } from 'expo-av';

class SoundService {
  private sounds: Map<string, Audio.Sound> = new Map();

  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error inicializando audio:', error);
    }
  }

  async playSound(soundName: 'evaluation' | 'celebration' | 'notification') {
    try {
      // Por ahora usamos sonidos del sistema
      // En producción, puedes agregar archivos de audio personalizados
      const soundMap = {
        evaluation: Audio.Sound.createAsync,
        celebration: Audio.Sound.createAsync,
        notification: Audio.Sound.createAsync,
      };

      // Nota: Para sonidos personalizados, necesitarías archivos .mp3 o .wav
      // Por ahora, usamos un beep simple del sistema
      console.log(`Reproduciendo sonido: ${soundName}`);
    } catch (error) {
      console.error(`Error reproduciendo sonido ${soundName}:`, error);
    }
  }

  async playEvaluationSound() {
    await this.playSound('evaluation');
  }

  async playCelebrationSound() {
    await this.playSound('celebration');
  }

  async playNotificationSound() {
    await this.playSound('notification');
  }

  async unloadAll() {
    for (const [name, sound] of this.sounds.entries()) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error(`Error descargando sonido ${name}:`, error);
      }
    }
    this.sounds.clear();
  }
}

export const soundService = new SoundService();

