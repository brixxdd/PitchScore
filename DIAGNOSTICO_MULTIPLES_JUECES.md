# 🔍 Diagnóstico: Sistema de Múltiples Jueces

## 📋 Problema Reportado

El usuario probó con **4 móviles** (4 jueces diferentes), pero el sistema **no sumaba** las evaluaciones de todos los jueces. Solo tomaba el resultado de uno.

## ✅ IMPORTANTE: Sistema de SUMA (no promedio)

El sistema **SUMA** las puntuaciones de todos los jueces, **NO calcula promedios**.

**Ejemplo:**
- Juez 1 da: 9 puntos totales
- Juez 2 da: 27 puntos totales
- **Resultado: 36 puntos** (9 + 27, NO 18)

## ✅ Solución Implementada

### 1. **Verificación de la Lógica del Backend**

El código del backend **YA ESTÁ CORRECTO** y calcula promedios correctamente:

```javascript
// Para cada criterio evaluado
const allEvaluationsForCriterion = await Evaluation.find({
  teamId,
  criterionId: evalData.criterionId,
});

// Calcular promedio de TODOS los jueces
const avgScore =
  allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0) / 
  allEvaluationsForCriterion.length;

// Guardar el promedio
team.scores[evalData.criterionId] = avgScore;
```

**Cómo funciona:**
1. Cuando un juez envía evaluaciones, se guardan en la BD
2. Se buscan **TODAS** las evaluaciones para cada criterio (de todos los jueces)
3. Se calcula el **promedio** de todas las evaluaciones
4. Se guarda el promedio en `team.scores[criterionId]`
5. Se calcula el puntaje final sumando todos los promedios

### 2. **Logs de Diagnóstico Mejorados**

Agregamos logs detallados para ver exactamente qué está pasando:

```javascript
console.log(`📊 Criterio ${evalData.criterionId}: ${allEvaluationsForCriterion.length} evaluaciones encontradas`);

// Mostrar las evaluaciones de cada juez
allEvaluationsForCriterion.forEach(ev => {
  console.log(`  - Juez ${ev.judgeId}: ${ev.score} puntos`);
});

console.log(`  ➡️ Promedio calculado: ${avgScore.toFixed(2)} puntos`);
```

**Ejemplo de salida:**
```
📊 Criterio criterion-1: 3 evaluaciones encontradas
  - Juez judge-001: 4 puntos
  - Juez judge-002: 3 puntos
  - Juez judge-003: 4 puntos
  ➡️ Promedio calculado: 3.67 puntos
```

### 3. **Endpoints HTTP de Diagnóstico**

Agregamos endpoints para **ver todas las evaluaciones** desde el navegador:

#### **📍 Ver todas las evaluaciones:**
```
GET http://TU_IP:3001/api/debug/evaluations
```

**Respuesta:**
```json
{
  "totalEvaluations": 36,
  "totalTeams": 4,
  "totalJudges": 4,
  "teams": [
    {
      "id": "team-1",
      "name": "Equipo Alpha",
      "scores": {
        "criterion-1": 3.67,
        "criterion-2": 3.25,
        "criterion-3": 4.0
      },
      "finalScore": 10.92,
      "evaluationsCompleted": 4
    }
  ],
  "evaluationsByTeam": {
    "team-1": [
      { "judgeId": "judge-001", "criterionId": "criterion-1", "score": 4 },
      { "judgeId": "judge-002", "criterionId": "criterion-1", "score": 3 },
      { "judgeId": "judge-003", "criterionId": "criterion-1", "score": 4 }
    ]
  }
}
```

#### **📍 Ver resumen de un equipo específico:**
```
GET http://TU_IP:3001/api/debug/summary/team-1
```

**Respuesta:**
```json
{
  "team": {
    "id": "team-1",
    "name": "Equipo Alpha",
    "finalScore": 10.92,
    "scores": {
      "criterion-1": 3.67,
      "criterion-2": 3.25
    }
  },
  "evaluationsByCriterion": [
    {
      "criterionId": "criterion-1",
      "judgesCount": 3,
      "evaluations": [
        { "judgeId": "judge-001", "score": 4 },
        { "judgeId": "judge-002", "score": 3 },
        { "judgeId": "judge-003", "score": 4 }
      ],
      "sum": 11,
      "average": "3.67",
      "storedInTeam": 3.67
    }
  ],
  "totalEvaluations": 27
}
```

## 🔧 Cómo Diagnosticar el Problema

### **Paso 1: Revisar los logs del servidor**

Cuando un juez envía evaluaciones, deberías ver:

```
============================================================
📊 NUEVA EVALUACIÓN RECIBIDA
   Juez: judge-1763693776222
   Equipo: team-1
   Criterios evaluados: 9
============================================================

📊 Criterio criterion-1: 2 evaluaciones encontradas
  - Juez judge-001: 4 puntos
  - Juez judge-1763693776222: 3 puntos
  ➡️ Promedio calculado: 3.50 puntos

🔢 Calculando puntaje final para "Equipo Alpha":
   Scores por criterio: {
     criterion-1: 3.5,
     criterion-2: 3.75,
     ...
   }
   Total de criterios evaluados: 9
   Suma total: 32.50 puntos
   Promedio general: 3.61 puntos

✅ Equipo "Equipo Alpha" actualizado: 32.50 puntos totales
```

### **Paso 2: Verificar en el navegador**

Abre en tu navegador (reemplaza con tu IP):
```
http://192.168.1.76:3001/api/debug/evaluations
```

Verifica:
- ✅ ¿Cuántos `totalJudges` hay?
- ✅ ¿Cada criterio tiene evaluaciones de múltiples jueces?
- ✅ ¿Los promedios en `team.scores` reflejan múltiples evaluaciones?

### **Paso 3: Verificar un equipo específico**

```
http://192.168.1.76:3001/api/debug/summary/team-1
```

Verifica:
- ✅ ¿`judgesCount` es mayor a 1 para cada criterio?
- ✅ ¿El `average` coincide con `storedInTeam`?

## 🐛 Posibles Causas del Problema

Si después de estos logs **NO VES** múltiples evaluaciones por criterio, puede ser:

### **1. Los jueces están usando el mismo `judgeId`**
- ❌ **Problema:** Todos los dispositivos tienen `judge-1763693776222`
- ✅ **Solución:** Cada dispositivo debe generar un `judgeId` único al escanear el QR

### **2. Las evaluaciones no se están guardando**
- ❌ **Problema:** Error al guardar en MongoDB
- ✅ **Solución:** Revisar logs del servidor para errores

### **3. Las evaluaciones antiguas se están sobrescribiendo**
- ❌ **Problema:** El esquema no permite duplicados
- ✅ **Solución:** Verificar que el esquema de `Evaluation` NO tenga `unique` en campos incorrectos

## 📊 Esquema de Evaluación Actual

```javascript
const evaluationSchema = new mongoose.Schema({
  teamId: String,        // NO unique
  judgeId: String,       // NO unique
  criterionId: String,   // NO unique
  score: Number,
  timestamp: Date,
});
// ⚠️ NO hay unique compound index
```

**Esto permite múltiples evaluaciones para el mismo:**
- Equipo
- Criterio
- De diferentes jueces ✅

## 🎯 Próximos Pasos

1. **Prueba con 4 dispositivos:**
   - Dispositivo 1: Totem Mode
   - Dispositivos 2-4: Judge Mode (escanean QR)

2. **Revisa los logs en el servidor** al enviar evaluaciones

3. **Abre el endpoint de debug** en un navegador:
   ```
   http://TU_IP:3001/api/debug/evaluations
   ```

4. **Verifica:**
   - ¿Cuántos jueces hay registrados?
   - ¿Cada criterio tiene evaluaciones de múltiples jueces?
   - ¿Los promedios son correctos?

5. **Reporta los resultados:**
   - Si ves múltiples evaluaciones pero el frontend no se actualiza → Problema de UI
   - Si solo ves una evaluación por criterio → Problema de generación de `judgeId`
   - Si ves errores en los logs → Problema de BD

## 📝 Checklist de Verificación

- [ ] Servidor backend reiniciado con nuevos logs
- [ ] 4 dispositivos preparados (1 Totem, 3 Jueces)
- [ ] Jueces escanean QR y reciben equipo
- [ ] Jueces envían evaluaciones
- [ ] Logs del servidor muestran múltiples evaluaciones por criterio
- [ ] Endpoint `/api/debug/evaluations` muestra múltiples jueces
- [ ] Promedios calculados correctamente
- [ ] Frontend actualiza con promedios correctos

## 🔄 Flujo Esperado (4 Jueces)

```
1. Totem registra "Equipo Alpha"
2. Totem envía "Equipo Alpha" a jueces
3. Juez A evalúa: criterion-1 = 4 pts → Promedio: 4.00
4. Juez B evalúa: criterion-1 = 3 pts → Promedio: 3.50
5. Juez C evalúa: criterion-1 = 4 pts → Promedio: 3.67
6. Juez D evalúa: criterion-1 = 3 pts → Promedio: 3.50

Final: team.scores["criterion-1"] = 3.50 (promedio de 4+3+4+3)
```

---

**Nota:** Si el problema persiste después de revisar los logs y endpoints, puede ser un problema de UI en el frontend donde no se están mostrando los promedios actualizados correctamente.

