# PitchScore - Sistema de Evaluación para Concursos

Aplicación React Native con Expo para evaluación en tiempo real de concursos.

## Características

- **Modo Totem**: Dispositivo grande en modo kiosko que muestra resultados y genera códigos QR
- **Modo Juez**: Dispositivos móviles para evaluar equipos según rúbrica específica
- **Tiempo Real**: Sincronización instantánea mediante Socket.io
- **QR Codes**: Sistema de tokens efímeros para conexión y evaluación

## Instalación

```bash
npm install
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
npm start

# Iniciar en Android
npm run android

# Iniciar en iOS
npm run ios

# Iniciar servidor backend
npm run server
```

## Estructura del Proyecto

```
├── app/              # Pantallas con Expo Router
│   ├── _layout.tsx  # Layout principal
│   ├── index.tsx    # Pantalla de inicio
│   ├── totem/       # Modo Totem
│   └── judge/       # Modo Juez
├── server/          # Backend Node.js/Express
├── components/      # Componentes reutilizables
├── services/        # Servicios (Socket.io, API)
└── types/           # TypeScript types
```

## Tecnologías

- React Native + Expo
- Expo Router
- Socket.io
- MongoDB Atlas
- TypeScript

