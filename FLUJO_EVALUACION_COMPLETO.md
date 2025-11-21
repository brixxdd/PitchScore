# Flujo de Evaluación Completo - Implementación

## 📝 Resumen de Cambios

Se ha implementado un **nuevo flujo de evaluación** donde los jueces reciben un equipo completo y evalúan **todos los criterios a la vez** en lugar de hacerlo uno por uno.

---

## 🔄 Flujo Anterior vs Nuevo Flujo

### ❌ Flujo Anterior
1. Totem selecciona un equipo → Totem selecciona un criterio
2. Jueces evalúan ese criterio específico
3. Totem selecciona el siguiente criterio
4. Repetir para cada criterio (9 veces)

**Problema:** Proceso lento y repetitivo

### ✅ Nuevo Flujo
1. Totem registra equipos
2. Totem **envía equipo completo** a jueces (botón "Enviar")
3. Equipo se **deshabilita** (no puede volver a enviarse)
4. Jueces reciben el equipo con **todos los criterios en lista**
5. Jueces evalúan **todos los criterios a la vez** (1-4 puntos cada uno)
6. Jueces envían **evaluación completa** de una sola vez

**Ventaja:** Proceso más rápido y eficiente

---

## 🎯 Cambios Implementados

### 1. **Tipos e Interfaces** (`types/index.ts`)
```typescript
export interface Team {
  // ... campos existentes ...
  sentToJudges?: boolean;           // Nuevo: indica si fue enviado
  evaluationsCompleted?: number;    // Nuevo: contador de evaluaciones
}

export interface SocketEvents {
  // Nuevo evento: enviar equipo a jueces
  'team:send-to-judges': { totemId: string; teamId: string };
  
  // Nuevo evento: equipo recibido por jueces
  'team:received': { team: Team };
}
```

### 2. **Modo Totem** (`app/totem/index.tsx`)

#### Cambios en el Panel de Administración:
- ✅ Botón "📤 Enviar" por cada equipo
- ✅ Equipos enviados muestran "✅ ENVIADO A JUECES"
- ✅ Equipos enviados se deshabilitan (no clicables)
- ✅ Botón cambia a "🔒 Enviado" después de enviar

#### Nueva Función:
```typescript
const handleSendTeamToJudges = (teamId: string) => {
  socketService.emit('team:send-to-judges', { totemId, teamId });
  // Marca como enviado localmente
  setTeams(prevTeams => 
    prevTeams.map(t => 
      t.id === teamId ? { ...t, sentToJudges: true } : t
    )
  );
};
```

### 3. **Modo Juez** (`app/judge/index.tsx`)

#### Nueva Pantalla de Evaluación:
- ✅ Muestra **TODOS los criterios** en lista
- ✅ Cada criterio tiene sus 4 niveles (botones 1-4)
- ✅ Barra de progreso: "X de 9 criterios evaluados"
- ✅ Validación: solo permite enviar si **todos** están evaluados
- ✅ Botón "✅ ENVIAR EVALUACIÓN COMPLETA"

#### Estado de Scores:
```typescript
const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
// Ejemplo: { "criterion-1": 4, "criterion-2": 3, ... }
```

#### Validación Antes de Enviar:
```typescript
const totalCriteria = CRITERIA.length;  // 9
const evaluatedCount = Object.keys(criteriaScores).length;

if (evaluatedCount !== totalCriteria) {
  Alert.alert('Evaluación Incompleta', 
    `Has evaluado ${evaluatedCount} de ${totalCriteria} criterios`);
  return;
}
```

#### Envío de Evaluaciones:
```typescript
// Envía TODAS las evaluaciones al servidor
for (const [criterionId, score] of Object.entries(criteriaScores)) {
  socketService.emit('evaluation:submit', {
    teamId: activeTeam.id,
    judgeId,
    criterionId,
    score,
  });
}
```

### 4. **Backend** (`server/index.js`)

#### Actualización del Esquema:
```javascript
const teamSchema = new mongoose.Schema({
  // ... campos existentes ...
  sentToJudges: { type: Boolean, default: false },
  evaluationsCompleted: { type: Number, default: 0 },
});
```

#### Nuevo Evento Socket:
```javascript
socket.on('team:send-to-judges', async (data) => {
  const team = await Team.findOne({ id: data.teamId });
  
  // Marcar como enviado
  team.sentToJudges = true;
  await team.save();
  
  // Emitir a TODOS los jueces del totem
  io.to(data.totemId).emit('team:received', { team });
  
  console.log(`✅ Equipo "${team.name}" enviado a jueces`);
});
```

### 5. **Base de Datos**

#### Script de Migración (`server/migrateTeamsSchema.js`)
Actualiza equipos existentes con los nuevos campos:

```bash
cd server
node migrateTeamsSchema.js
```

Esto agrega:
- `sentToJudges: false` (por defecto)
- `evaluationsCompleted: 0` (por defecto)

---

## 🎨 Interfaz de Usuario

### Totem - Panel de Administración
```
┌─────────────────────────────────────────┐
│ 📋 Equipos Registrados                  │
│                                         │
│ [Equipo Alpha          ] [📤 Enviar]    │
│ [Equipo Beta           ] [📤 Enviar]    │
│ [Equipo Gamma          ] [🔒 Enviado]   │
│   ✅ ENVIADO A JUECES                   │
└─────────────────────────────────────────┘
```

### Judge - Pantalla de Evaluación
```
┌─────────────────────────────────────────┐
│ 🎯 EQUIPO A EVALUAR: Equipo Alpha       │
│ Progreso: 3 de 9 criterios evaluados    │
│ [████████░░░░░░░░] 33%                  │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Evalúa todos los criterios           │
│                                         │
│ 1️⃣ Problema y necesidad del mercado    │
│    [1 Deficiente] [2 Regular]           │
│    [3 Bueno] [4 Excelente ✓]            │
│                                         │
│ 2️⃣ Propuesta única de valor            │
│    [1] [2] [3 ✓] [4]                    │
│                                         │
│ ... (7 criterios más)                   │
│                                         │
│ [✅ ENVIAR EVALUACIÓN COMPLETA]         │
└─────────────────────────────────────────┘
```

---

## 🚀 Cómo Usar el Nuevo Flujo

### Para el Administrador (Totem):

1. **Registrar equipos:**
   - Ir a "Panel de Administración"
   - Ingresar nombre del equipo
   - Presionar "➕ Agregar Equipo"

2. **Enviar equipo a jueces:**
   - Presionar "📤 Enviar" en el equipo deseado
   - El equipo se marcará como "✅ ENVIADO A JUECES"
   - El botón cambiará a "🔒 Enviado" (deshabilitado)

3. **Ver resultados:**
   - Ir a "Ver Resultados en Tiempo Real"
   - Los puntajes se actualizarán automáticamente

### Para los Jueces:

1. **Conectarse:**
   - Abrir app en modo Juez
   - Escanear QR del totem

2. **Esperar equipo:**
   - Esperar a que el administrador envíe un equipo
   - Recibirás una alerta: "🎯 Nuevo Equipo para Evaluar"

3. **Evaluar:**
   - Verás todos los 9 criterios en lista
   - Selecciona un puntaje (1-4) para **cada criterio**
   - La barra de progreso mostrará cuántos has completado

4. **Enviar:**
   - Una vez evaluados los 9 criterios
   - Presionar "✅ ENVIAR EVALUACIÓN COMPLETA"
   - Recibirás confirmación de envío exitoso

---

## 🔧 Comandos Útiles

### Migrar Base de Datos:
```bash
cd server
node migrateTeamsSchema.js
```

### Iniciar Backend:
```bash
cd server
npm run dev
```

### Iniciar Frontend:
```bash
npx expo start --clear
```

---

## ✅ Checklist de Verificación

- [X] Tipos actualizados con `sentToJudges` y `evaluationsCompleted`
- [X] Evento `team:send-to-judges` implementado
- [X] Evento `team:received` implementado
- [X] Totem deshabilita equipos enviados
- [X] Judge muestra todos los criterios
- [X] Judge valida evaluación completa
- [X] Backend actualizado con nuevos eventos
- [X] Esquema de BD actualizado
- [X] Script de migración creado

---

## 📋 Archivos Modificados

1. **Frontend:**
   - `types/index.ts` - Nuevos tipos e interfaces
   - `app/totem/index.tsx` - Botón enviar y deshabilitar equipos
   - `app/judge/index.tsx` - Nueva pantalla con todos los criterios

2. **Backend:**
   - `server/index.js` - Evento `team:send-to-judges`
   - `server/initDB.js` - Esquema actualizado

3. **Scripts:**
   - `server/migrateTeamsSchema.js` - Migración de equipos

4. **Documentación:**
   - `checklist.txt` - Actualizado con nuevo flujo
   - `FLUJO_EVALUACION_COMPLETO.md` - Este documento

---

## 🎉 Resultado Final

Los jueces ahora pueden:
✅ Recibir un equipo completo
✅ Ver todos los criterios a la vez
✅ Evaluar a su propio ritmo
✅ Enviar evaluación completa de una sola vez

Los administradores pueden:
✅ Enviar equipos de forma controlada
✅ Evitar envíos duplicados (equipos se deshabilitan)
✅ Ver resultados en tiempo real

**¡El flujo es ahora más eficiente y menos propenso a errores!** 🚀

