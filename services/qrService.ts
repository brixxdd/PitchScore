import { QRToken } from '../types';
import { QR_TOKEN_EXPIRY } from '../config/constants';

export class QRService {
  /**
   * Genera un token efímero para QR
   */
  static generateToken(
    totemId: string,
    teamId?: string,
    criterionId?: string
  ): QRToken {
    return {
      totemId,
      teamId,
      criterionId,
      expiresAt: Date.now() + QR_TOKEN_EXPIRY,
    };
  }

  /**
   * Convierte un token a string JSON para el QR
   */
  static tokenToQRString(token: QRToken): string {
    return JSON.stringify(token);
  }

  /**
   * Parsea un string QR a token
   */
  static QRStringToToken(qrString: string): QRToken | null {
    try {
      const token = JSON.parse(qrString) as QRToken;
      return token;
    } catch (error) {
      console.error('Error parsing QR string:', error);
      return null;
    }
  }

  /**
   * Valida si un token está expirado
   */
  static isTokenExpired(token: QRToken): boolean {
    return Date.now() > token.expiresAt;
  }

  /**
   * Valida un token completo
   */
  static validateToken(token: QRToken): { valid: boolean; reason?: string } {
    if (!token.totemId) {
      return { valid: false, reason: 'Token sin totemId' };
    }

    if (this.isTokenExpired(token)) {
      return { valid: false, reason: 'Token expirado' };
    }

    return { valid: true };
  }
}

