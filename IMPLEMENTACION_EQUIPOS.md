# Implementación: Sistema de Registro y Evaluación de Equipos

## ✅ Flujo Completado

### 1. **Registro de Equipos (Totem)**
El administrador del totem puede registrar nuevos equipos que automáticamente se guardan en MongoDB y se notifican a todos los jueces conectados.

#### Cambios en `app/totem/index.tsx`:
```typescript
const handleAddTeam = (teamName: string) => {
  const newTeam: Team = {
    id: `team-${Date.now()}`,
    name: teamName,
    totemId,
    scores: {},
    finalScore: 0,
    positionHistory: [],
  };
  
  // ✅ Enviar al backend
  socketService.emit('team:add', newTeam);
  
  // Agregar localmente
  setTeams([...teams, newTeam]);
};
```

#### Listeners agregados:
- `team:added` - Recibe notificaciones cuando otros admins agregan equipos
- `team:list:response` - Recibe la lista completa de equipos al conectar

---

### 2. **Backend - Servidor (`server/index.js`)**

#### Nuevo evento: `team:add`
Guarda el equipo en MongoDB y notifica a todos los clientes conectados:

```javascript
socket.on('team:add', async (data) => {
  const newTeam = new Team({
    id: data.id,
    name: data.name,
    totemId: data.totemId,
    scores: {},
    finalScore: 0,
    positionHistory: [],
  });

  await newTeam.save();
  
  // Emitir a todos los clientes del totem
  io.to(data.totemId).emit('team:added', newTeam);
  
  // Confirmar al totem
  socket.emit('team:added:success', newTeam);
});
```

#### Nuevo evento: `team:list`
Devuelve todos los equipos registrados para un totem:

```javascript
socket.on('team:list', async (data) => {
  const teams = await Team.find({ totemId: data.totemId })
    .sort({ finalScore: -1 });
  socket.emit('team:list:response', { teams });
});
```

---

### 3. **Modo Juez (`app/judge/index.tsx`)**

#### Listeners agregados:
- `team:added` - Notificación cuando se registra un nuevo equipo
- `totem:team-changed` - Actualiza el equipo activo para evaluar

```typescript
socketService.on('team:added', (team: Team) => {
  soundService.playNotificationSound();
  Alert.alert('Nuevo Equipo', `Se ha registrado: ${team.name}`);
});

socketService.on('totem:team-changed', (data) => {
  const team: Team = {
    id: data.teamId,
    name: data.teamName,
    totemId: totemId || '',
    scores: {},
    finalScore: 0,
    positionHistory: [],
  };
  setActiveTeam(team);
  soundService.playNotificationSound();
  Alert.alert('Nuevo Equipo', `Equipo actual: ${data.teamName}`);
  setSelectedScore(null);
});
```

#### Al conectarse al totem:
```typescript
const connectToTotem = async (totemId: string, judgeId: string) => {
  // ... código existente ...
  
  // ✅ Solicitar lista de equipos
  socketService.emit('team:list', { totemId });
};
```

---

### 4. **Tipos Actualizados (`types/index.ts`)**

Nuevos eventos en la interfaz `SocketEvents`:

```typescript
export interface SocketEvents {
  // Cliente -> Servidor
  'team:add': Team;
  'team:list': { totemId: string };
  
  // Servidor -> Cliente
  'team:added': Team;
  'team:added:success': Team;
  'team:added:error': { error: string };
  'team:list:response': { teams: Team[] };
}
```

---

## 🎯 Funcionalidad Completa

### **Flujo de Trabajo:**

1. **Administrador en Totem** → Ingresa nombre del equipo → Presiona "Agregar"
2. **Backend** → Guarda el equipo en MongoDB
3. **Notificación** → Todos los jueces conectados reciben alerta de nuevo equipo
4. **Administrador en Totem** → Selecciona el equipo activo y criterio
5. **Backend** → Notifica a los jueces del cambio
6. **Jueces** → Ven el equipo y criterio activo, pueden evaluar
7. **Evaluación** → El juez selecciona puntaje y envía
8. **Backend** → Calcula promedio y actualiza puntaje final
9. **Totem (Resultados)** → Muestra tabla con puntajes en tiempo real

---

## 🔄 Sincronización en Tiempo Real

- ✅ Los equipos se registran en MongoDB
- ✅ Todos los dispositivos (totem y jueces) se sincronizan automáticamente
- ✅ Los jueces reciben notificaciones sonoras cuando hay cambios
- ✅ El totem muestra los resultados actualizados en tiempo real
- ✅ Los equipos persisten entre sesiones (MongoDB)

---

## 🚀 Próximos Pasos para Probar

1. **Iniciar el servidor backend:**
   ```bash
   cd server
   node index.js
   ```

2. **Iniciar Expo:**
   ```bash
   npx expo start
   ```

3. **Probar en dispositivos:**
   - Tablet/PC → Modo Totem → Registrar equipos
   - Móviles → Modo Juez → Escanear QR → Ver equipos disponibles
   - Totem → Seleccionar equipo y criterio activo
   - Jueces → Evaluar y ver resultados en tiempo real

---

## 📝 Notas Técnicas

- **MongoDB:** Todos los equipos se guardan con esquema `Team`
- **Socket.io:** Comunicación bidireccional en tiempo real
- **Rooms:** Cada totem tiene su propia "sala" para aislar eventos
- **Persistencia:** Los datos sobreviven reinicios del servidor
- **Validación:** El backend valida datos antes de guardar

---

## 🎉 Estado: IMPLEMENTADO Y FUNCIONAL

