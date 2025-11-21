# 🚀 Guía de Inicio Rápido - PitchScore

## 📱 ¿Qué verás al abrir la app?

### Pantalla Inicial
Al abrir la app verás:
- **Título**: PitchScore
- **Subtítulo**: Sistema de Evaluación para Concursos
- **Dos botones grandes**:
  - 🟢 **Modo Totem** (verde) - Para el dispositivo principal
  - 🔵 **Modo Juez** (azul) - Para dispositivos móviles de jueces

---

## 🖥️ Modo Totem (Dispositivo Principal)

### Pantalla de Bienvenida
- Fondo negro (modo kiosko)
- **QR Code** grande en el centro para conexión de jueces
- Indicador de conexión (🟢 Conectado / 🟠 Conectando / 🔴 Desconectado)
- Botones:
  - **Panel de Administración**
  - **Ver Resultados**

### Panel de Administración
- **Registrar Equipos**: Campo de texto + botón "Agregar Equipo"
- **Lista de Equipos**: Toca un equipo para activarlo
- **Criterios de Evaluación**: Lista de 9 criterios, toca uno para activarlo
- Botón para ver resultados en tiempo real

### Pantalla de Resultados
- **Promedios por Criterio**: Scroll horizontal con promedios
- **Tabla Clasificatoria**:
  - Posición (badge circular)
  - Nombre del equipo
  - Puntaje total (con animación)
  - Equipo en primer lugar resaltado en dorado
  - Equipo activo con borde azul

---

## 📱 Modo Juez (Dispositivos Móviles)

### Pantalla de Escaneo
- Cámara activa para escanear QR
- Indicador de conexión
- Botón "Ver Historial" (si ya hay evaluaciones)

### Pantalla de Evaluación
- **Equipo Actual**: Nombre del equipo a evaluar
- **Criterio Actual**: Nombre y descripción del criterio
- **Sistema de Puntuación**: 4 botones circulares (1, 2, 3, 4)
- **Indicador**: "Faltan X jueces por evaluar"
- **Botón**: "Enviar Evaluación" (solo aparece cuando seleccionas puntuación)

### Historial
- Lista de todas tus evaluaciones
- Muestra criterio, puntuación y fecha

---

## ⚙️ Requisitos para Funcionar

### 1. Servidor Backend
**IMPORTANTE**: El servidor debe estar corriendo para que la app funcione.

```bash
# Terminal 1: Iniciar servidor
cd server
npm start
# o en modo desarrollo:
npm run dev
```

Deberías ver:
```
✅ MongoDB Atlas conectado
Servidor corriendo en puerto 3001
```

### 2. Configuración de Red
- **En desarrollo**: Asegúrate de que el móvil y la computadora estén en la misma red WiFi
- **URL del servidor**: Por defecto usa `http://localhost:3001`
- **Para dispositivos físicos**: Cambia `localhost` por la IP de tu computadora

Ejemplo:
```bash
# En Windows, obtén tu IP:
ipconfig
# Busca "IPv4 Address" (ej: 192.168.1.100)

# Luego en la app, configura:
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

### 3. Permisos Necesarios
- **Cámara**: Para escanear QR (se solicita automáticamente)
- **Internet**: Para conectar con MongoDB Atlas y Socket.io

---

## 🔄 Flujo de Uso Típico

1. **Iniciar Servidor**:
   ```bash
   cd server
   npm start
   ```

2. **Abrir App en Totem**:
   - Toca "Modo Totem"
   - Verás el QR para conexión
   - Toca "Panel de Administración"
   - Registra equipos
   - Selecciona equipo y criterio activos

3. **Abrir App en Juez**:
   - Toca "Modo Juez"
   - Escanea el QR del totem
   - Verás el equipo y criterio actual
   - Selecciona puntuación (1-4)
   - Toca "Enviar Evaluación"

4. **Ver Resultados**:
   - En el Totem, toca "Ver Resultados"
   - Verás la tabla actualizada en tiempo real
   - Las animaciones se activan cuando cambian posiciones

---

## ⚠️ Problemas Comunes

### "No se puede conectar al servidor"
- ✅ Verifica que el servidor esté corriendo
- ✅ Verifica que estés en la misma red WiFi
- ✅ Usa la IP correcta (no localhost en dispositivos físicos)

### "QR no se escanea"
- ✅ Verifica permisos de cámara
- ✅ Asegúrate de tener buena iluminación
- ✅ El QR expira cada 5 minutos (se renueva automáticamente)

### "No aparecen equipos"
- ✅ Verifica conexión a MongoDB Atlas
- ✅ Asegúrate de haber registrado equipos en el Panel de Administración

### "No se actualizan los resultados"
- ✅ Verifica que Socket.io esté conectado (indicador verde)
- ✅ Verifica que el servidor esté recibiendo las evaluaciones

---

## 🎯 Próximos Pasos

1. **Probar en dispositivo físico**: Usa Expo Go o genera un build
2. **Configurar IP fija**: Para facilitar la conexión
3. **Personalizar sonidos**: Agrega archivos de audio personalizados
4. **Ajustar diseño**: Modifica colores y estilos según necesidad

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs del servidor
2. Verifica la consola de Expo
3. Comprueba la conexión a MongoDB Atlas

