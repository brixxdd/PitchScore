# ➕ Sistema de Suma entre Jueces

## 📋 Cambio Importante: SUMA vs PROMEDIO

### ❌ **ANTES (PROMEDIO):**
```
Juez 1: criterion-1 = 4 puntos
Juez 2: criterion-1 = 2 puntos
Resultado: 3 puntos (promedio: 6 ÷ 2)
```

### ✅ **AHORA (SUMA):**
```
Juez 1: criterion-1 = 4 puntos
Juez 2: criterion-1 = 2 puntos
Resultado: 6 puntos (suma: 4 + 2)
```

## 🎯 Lógica del Sistema

### **1. Evaluación por Criterio**
Cada juez evalúa los 9 criterios del equipo:
- **criterion-1**: Problema y necesidad del mercado (1-4 pts)
- **criterion-2**: Propuesta única de valor e impacto (1-4 pts)
- **criterion-3**: Perfil del cliente ideal (1-4 pts)
- **criterion-4**: Estrategia de mercadotecnia (1-4 pts)
- **criterion-5**: Análisis de la competencia (1-4 pts)
- **criterion-6**: Metas a corto y mediano plazo (1-4 pts)
- **criterion-7**: Prototipo del producto o servicio (1-4 pts)
- **criterion-8**: Resumen financiero (1-4 pts)
- **criterion-9**: Preguntas y respuestas ante los jueces (1-4 pts)

**Máximo por juez:** 36 puntos (9 criterios × 4 pts máximos)

### **2. Suma de Todos los Jueces**
El sistema **SUMA** las evaluaciones de todos los jueces para cada criterio:

```javascript
// Para cada criterio
const allEvaluationsForCriterion = await Evaluation.find({
  teamId,
  criterionId: evalData.criterionId,
});

// SUMAR (no promediar)
const totalScore = allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0);

team.scores[evalData.criterionId] = totalScore;
```

### **3. Puntaje Final del Equipo**
El puntaje final es la **suma de todas las sumas** de cada criterio:

```javascript
const finalScore = Object.values(team.scores).reduce(
  (sum, score) => sum + score,
  0
);
```

## 📊 Ejemplo Completo (3 Jueces)

### **Evaluaciones:**

**Juez 1 evalúa "Equipo Alpha":**
```
criterion-1: 4 pts
criterion-2: 3 pts
criterion-3: 4 pts
criterion-4: 3 pts
criterion-5: 4 pts
criterion-6: 3 pts
criterion-7: 4 pts
criterion-8: 3 pts
criterion-9: 4 pts
────────────────
Total: 32 pts
```

**Juez 2 evalúa "Equipo Alpha":**
```
criterion-1: 3 pts
criterion-2: 2 pts
criterion-3: 3 pts
criterion-4: 2 pts
criterion-5: 3 pts
criterion-6: 2 pts
criterion-7: 3 pts
criterion-8: 2 pts
criterion-9: 3 pts
────────────────
Total: 23 pts
```

**Juez 3 evalúa "Equipo Alpha":**
```
criterion-1: 4 pts
criterion-2: 4 pts
criterion-3: 3 pts
criterion-4: 4 pts
criterion-5: 3 pts
criterion-6: 4 pts
criterion-7: 3 pts
criterion-8: 4 pts
criterion-9: 3 pts
────────────────
Total: 32 pts
```

### **Resultado Final:**

**Suma por Criterio:**
```
criterion-1: 4 + 3 + 4 = 11 pts
criterion-2: 3 + 2 + 4 = 9 pts
criterion-3: 4 + 3 + 3 = 10 pts
criterion-4: 3 + 2 + 4 = 9 pts
criterion-5: 4 + 3 + 3 = 10 pts
criterion-6: 3 + 2 + 4 = 9 pts
criterion-7: 4 + 3 + 3 = 10 pts
criterion-8: 3 + 2 + 4 = 9 pts
criterion-9: 4 + 3 + 3 = 10 pts
```

**Puntaje Final del Equipo:**
```
11 + 9 + 10 + 9 + 10 + 9 + 10 + 9 + 10 = 87 puntos
```

**O más simple:**
```
Juez 1: 32 pts
Juez 2: 23 pts
Juez 3: 32 pts
───────────────
Total: 87 pts
```

## 🔍 Logs del Servidor

Cuando un juez envía evaluaciones, ahora verás:

```
============================================================
📊 NUEVA EVALUACIÓN RECIBIDA
   Juez: judge-1763702499577
   Equipo: team-1
   Criterios evaluados: 9
============================================================

📊 Criterio criterion-1: 3 evaluaciones encontradas
  - Juez judge-001: 4 puntos
  - Juez judge-002: 3 puntos
  - Juez judge-003: 4 puntos
  ➡️ Suma total calculada: 11 puntos

📊 Criterio criterion-2: 3 evaluaciones encontradas
  - Juez judge-001: 3 puntos
  - Juez judge-002: 2 puntos
  - Juez judge-003: 4 puntos
  ➡️ Suma total calculada: 9 puntos

...

🔢 Calculando puntaje final para "Equipo Alpha":
   Scores por criterio (sumados entre jueces): {
     criterion-1: 11,
     criterion-2: 9,
     criterion-3: 10,
     ...
   }
   Total de criterios evaluados: 9
   PUNTAJE FINAL (suma de todos los jueces): 87 puntos
```

## 🧪 Verificación

### **Endpoint de Debug:**
```
GET http://TU_IP:3001/api/debug/summary/team-1
```

**Respuesta:**
```json
{
  "team": {
    "id": "team-1",
    "name": "Equipo Alpha",
    "finalScore": 87,
    "scores": {
      "criterion-1": 11,
      "criterion-2": 9,
      "criterion-3": 10,
      ...
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
      "totalSum": 11,
      "storedInTeam": 11,
      "note": "storedInTeam debe ser igual a totalSum (suma de todos los jueces)"
    }
  ]
}
```

**Verificación Manual:**
```
totalSum = 4 + 3 + 4 = 11 ✅
storedInTeam = 11 ✅
```

## 🎓 Resumen

| Concepto | Descripción |
|----------|-------------|
| **Puntaje Individual** | Cada juez da 1-4 puntos por criterio |
| **Puntaje por Criterio** | SUMA de todos los jueces para ese criterio |
| **Puntaje Final del Equipo** | SUMA de todos los criterios (ya sumados entre jueces) |
| **Máximo por Juez** | 36 puntos (9 × 4) |
| **Máximo con 3 Jueces** | 108 puntos (36 × 3) |
| **Máximo con 5 Jueces** | 180 puntos (36 × 5) |

## 🔧 Código Relevante

### **Backend: `server/index.js`**
```javascript
// SUMAR los puntajes de todos los jueces
const totalScore = allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0);
team.scores[evalData.criterionId] = totalScore;

// Puntaje final = suma de todas las sumas
const finalScore = Object.values(team.scores).reduce(
  (sum, score) => sum + score,
  0
);
team.finalScore = finalScore;
```

## ✅ Ventajas de Este Sistema

1. **Más Jueces = Más Puntos:** Equipos con más evaluaciones tienen más puntos
2. **Transparente:** Fácil de entender y verificar
3. **Sin Promedios:** No hay confusión con decimales
4. **Justo:** Todos los jueces contribuyen por igual

## ⚠️ Consideraciones

- Si un equipo es evaluado por **3 jueces** y otro por **2 jueces**, el primero tendrá una ventaja
- **Solución:** Asegurarse de que todos los equipos sean evaluados por el **mismo número de jueces**
- El Totem debe enviar cada equipo a **todos los jueces registrados**

---

**Última actualización:** 2025-11-21  
**Sistema de Evaluación:** SUMA (no promedio)

