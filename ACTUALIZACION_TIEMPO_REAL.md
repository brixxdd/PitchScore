# Sistema de Actualización en Tiempo Real

## 🔄 Flujo de Evaluación y Actualización

Este documento explica cómo funciona el sistema de actualización en tiempo real cuando los jueces envían sus evaluaciones.

---

## 📊 Proceso Completo

### 1. **Juez Completa Evaluación**

Cuando un juez completa la evaluación de todos los criterios (9 en total):

```typescript
// app/judge/index.tsx
socketService.emit('evaluation:submit-batch', {
  teamId: activeTeam.id,
  judgeId,
  evaluations: [
    { criterionId: 'criterion-1', score: 4 },
    { criterionId: 'criterion-2', score: 3 },
    // ... 9 criterios en total
  ],
});
```

**Ventaja:** Envía todas las evaluaciones en un solo evento, evitando 9 requests individuales.

---

### 2. **Servidor Procesa Evaluaciones (BATCH)**

El servidor recibe el evento `evaluation:submit-batch` y:

1. **Guarda todas las evaluaciones en MongoDB**
   ```javascript
   for (const evalData of judgeEvaluations) {
     const evaluation = new Evaluation({
       teamId,
       judgeId,
       criterionId: evalData.criterionId,
       score: evalData.score,
       timestamp: new Date(),
     });
     await evaluation.save();
   }
   ```

2. **Calcula promedios por criterio**
   - Para cada criterio evaluado, busca TODAS las evaluaciones de todos los jueces
   - Calcula el promedio: `suma de scores / número de jueces`
   
   ```javascript
   const allEvaluationsForCriterion = await Evaluation.find({
     teamId,
     criterionId: evalData.criterionId,
   });
   
   const avgScore = 
     allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0) / 
     allEvaluationsForCriterion.length;
   
   team.scores[evalData.criterionId] = avgScore;
   ```

3. **Recalcula puntaje final del equipo**
   - Suma todos los promedios de los criterios
   
   ```javascript
   const finalScore = Object.values(team.scores).reduce(
     (sum, score) => sum + score,
     0
   );
   team.finalScore = finalScore;
   ```

4. **Actualiza contador de evaluaciones**
   ```javascript
   team.evaluationsCompleted = (team.evaluationsCompleted || 0) + 1;
   ```

5. **Guarda cambios en la BD**
   ```javascript
   await team.save();
   ```

---

### 3. **Servidor Emite Actualizaciones (BROADCAST)**

El servidor emite dos eventos a TODOS los clientes conectados al totem:

#### 📡 Evento 1: `team:updated`
Envía el equipo actualizado:
```javascript
io.to(team.totemId).emit('team:updated', team);
```

#### 📡 Evento 2: `results:updated`
Envía TODOS los equipos ordenados por puntaje:
```javascript
const allTeams = await Team.find({ totemId: team.totemId })
  .sort({ finalScore: -1 });

io.to(team.totemId).emit('results:updated', { teams: allTeams });
```

#### 📡 Evento 3: `evaluation:complete`
Confirma al juez que su evaluación fue procesada:
```javascript
socket.emit('evaluation:complete', {
  teamId,
  judgeId,
  finalScore: team.finalScore,
  teamName: team.name,
});
```

---

### 4. **Totem Recibe y Actualiza UI**

El Totem escucha ambos eventos y actualiza la interfaz:

#### Listener: `team:updated`
Actualiza un equipo específico en el estado:
```typescript
socketService.on('team:updated', (team: Team) => {
  setTeams((prev) => {
    const updated = prev.map((t) => (t.id === team.id ? team : t));
    const sorted = updated.sort((a, b) => b.finalScore - a.finalScore);
    return sorted;
  });
});
```

#### Listener: `results:updated`
Actualiza TODA la tabla de resultados:
```typescript
socketService.on('results:updated', (data: { teams: Team[] }) => {
  const sorted = data.teams.sort((a, b) => b.finalScore - a.finalScore);
  
  // Verificar si hay nuevo primer lugar
  if (sorted.length > 0) {
    const currentFirstPlace = sorted[0].id;
    if (currentFirstPlace !== previousFirstPlace.current) {
      soundService.playCelebrationSound(); // 🎉
      console.log('🏆 ¡Nuevo primer lugar!', sorted[0].name);
    }
  }
  
  setTeams(sorted);
});
```

---

## 🎯 Ventajas del Sistema Actual

### ✅ **Batch Processing**
- Envía todas las evaluaciones en un solo evento
- Reduce latencia y tráfico de red
- Evita condiciones de carrera

### ✅ **Actualización Automática**
- El Totem se actualiza automáticamente sin intervención
- No requiere recargar o actualizar manualmente
- Los cambios son instantáneos

### ✅ **Ranking Dinámico**
- El orden de los equipos cambia en tiempo real
- Detecta automáticamente cambios de primer lugar
- Reproduce efectos de sonido para eventos importantes

### ✅ **Promedios Precisos**
- Calcula promedios considerando TODAS las evaluaciones
- Actualiza el puntaje final correctamente
- Mantiene historial de evaluaciones

---

## 📈 Ejemplo de Flujo Completo

### Escenario:
- **3 Jueces** conectados
- **2 Equipos** registrados: "Alpha" y "Beta"
- **9 Criterios** de evaluación

### Paso a Paso:

1. **Juez 1 evalúa a "Alpha"**
   ```
   Alpha: criterios 1-9 evaluados
   → Server calcula promedios (1 juez por ahora)
   → Totem actualiza: Alpha = 28 puntos
   ```

2. **Juez 2 evalúa a "Beta"**
   ```
   Beta: criterios 1-9 evaluados
   → Server calcula promedios (1 juez)
   → Totem actualiza: Beta = 32 puntos
   → 🏆 Beta sube a primer lugar!
   → 🎉 Sonido de celebración
   ```

3. **Juez 3 evalúa a "Alpha"**
   ```
   Alpha: criterios 1-9 evaluados (ahora 2 jueces)
   → Server recalcula promedios con 2 jueces
   → Totem actualiza: Alpha = 33 puntos
   → 🏆 Alpha sube a primer lugar!
   → 🎉 Sonido de celebración
   ```

4. **Ranking Final (hasta ahora)**
   ```
   1. 🥇 Alpha - 33.0 pts (2 evaluaciones)
   2. 🥈 Beta  - 32.0 pts (1 evaluación)
   ```

---

## 🔧 Tecnologías Utilizadas

- **Socket.io**: Comunicación bidireccional en tiempo real
- **MongoDB**: Almacenamiento persistente de evaluaciones
- **React State**: Manejo de estado reactivo en UI
- **Expo Sound**: Efectos de sonido para feedback

---

## 🐛 Debugging

### Ver logs en el servidor:
```bash
cd server
npm run dev
```

Verás:
```
📊 Procesando 9 evaluaciones del juez judge-123 para equipo team-456
✅ Equipo "Alpha" actualizado: 33.50 puntos
📢 Resultados actualizados emitidos al totem totem-1
```

### Ver logs en el cliente (Totem):
Abre la consola del navegador o Expo DevTools:
```
📊 Resultados actualizados recibidos: 2 equipos
🏆 ¡Nuevo primer lugar! Alpha
```

### Ver logs en el cliente (Judge):
```
✅ Evaluación completa confirmada para Alpha: 33.50 puntos
```

---

## 🎨 Efectos Visuales y Sonoros

### Sonidos:
- **🎉 Celebración**: Cuando hay nuevo primer lugar
- **🔔 Notificación**: Cuando se actualizan resultados
- **✅ Confirmación**: Cuando se envía evaluación

### Animaciones:
- **Escalado**: Equipos que suben de posición
- **Color**: Primer lugar resaltado en dorado
- **Transiciones**: Cambios suaves en el ranking

---

## 🚀 Optimizaciones Futuras

1. **Debouncing**: Si múltiples jueces envían evaluaciones simultáneamente, agrupar actualizaciones
2. **Websocket Rooms**: Separar totems por salas para evitar conflictos
3. **Caché**: Cachear promedios calculados para mejorar rendimiento
4. **Notificaciones**: Notificaciones push a jueces cuando haya cambios importantes

---

## ✅ Checklist de Verificación

- [X] Servidor procesa evaluaciones en batch
- [X] Servidor emite `team:updated` y `results:updated`
- [X] Totem escucha ambos eventos
- [X] Totem actualiza ranking automáticamente
- [X] Totem detecta cambios de primer lugar
- [X] Totem reproduce sonidos apropiados
- [X] Judge recibe confirmación de envío
- [X] Promedios se calculan correctamente
- [X] Puntajes finales se actualizan en tiempo real

---

## 📝 Comandos de Prueba

### Iniciar Backend:
```powershell
cd server
npm run dev
```

### Iniciar Frontend:
```powershell
npx expo start --clear
```

### Probar Flujo Completo:
1. Abrir app en **2 dispositivos en Modo Juez**
2. Abrir app en **1 dispositivo en Modo Totem**
3. Totem: Registrar 2 equipos → Enviar ambos a jueces
4. Juez 1: Evaluar Equipo 1 con puntajes altos
5. Juez 2: Evaluar Equipo 2 con puntajes bajos
6. **Verificar en Totem**: Ranking actualizado, Equipo 1 en primer lugar
7. Juez 2: Evaluar Equipo 1 con puntajes altos
8. **Verificar en Totem**: Puntajes actualizados, promedios correctos

---

## 🎯 ¡Listo para Usar!

El sistema ahora actualiza los resultados en **tiempo real** automáticamente. Cada vez que un juez envía evaluaciones, el ranking se recalcula y se muestra instantáneamente en el Totem. 🚀

