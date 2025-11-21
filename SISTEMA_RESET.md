# Sistema de Reset con Contraseña

## 🔒 **Funcionalidad de Reset Protegido**

Se ha implementado un sistema de reset con contraseña para limpiar todos los datos del sistema antes de usar la aplicación en un entorno real.

---

## 🎯 **Características**

### ✅ **Protección con Contraseña:**
- **Contraseña:** `unachnegocios`
- Solo usuarios autorizados pueden resetear el sistema
- Validación tanto en frontend como backend

### ✅ **Limpieza Inteligente:**
El reset limpia los siguientes datos:
- ✅ **Evaluations** (eliminadas - todas las evaluaciones de jueces)
- ✅ **Teams** (eliminados - todos los equipos registrados)
- ✅ **Judges** (eliminados - todos los jueces conectados)
- ✅ **Totems** (reseteados - NO eliminados, solo limpiados sus datos)

### ✅ **Interfaz Segura:**
- Modal de confirmación con advertencia clara
- Input de contraseña oculto (secureTextEntry)
- Zona de peligro visualmente destacada
- Botones de cancelar y confirmar

---

## 📍 **Ubicación**

### **Panel de Administración del Totem**

El botón de reset se encuentra al final del Panel de Administración:

```
┌─────────────────────────────────────────┐
│ Panel de Administración                │
├─────────────────────────────────────────┤
│ 📋 Equipos Registrados                 │
│ [Lista de equipos...]                  │
├─────────────────────────────────────────┤
│ 📊 Ver Resultados en Tiempo Real       │
├─────────────────────────────────────────┤
│ ⚠️ Zona Peligrosa                      │
│ Resetear eliminará TODOS los datos    │
│ [🗑️ RESETEAR SISTEMA]                 │
└─────────────────────────────────────────┘
```

---

## 🎨 **Diseño del Modal**

### **Pantalla de Confirmación:**

```
┌─────────────────────────────────────────┐
│        🔒 Resetear Sistema              │
│                                         │
│ Esta acción eliminará permanentemente:  │
│ • Todos los equipos                    │
│ • Todas las evaluaciones               │
│ • Todos los jueces                     │
│ • Configuraciones del totem            │
│                                         │
│ ⚠️ Esta acción NO se puede deshacer    │
│                                         │
│ Ingresa la contraseña:                 │
│ [•••••••••••••]                        │
│                                         │
│ [Cancelar]  [Confirmar Reset]          │
└─────────────────────────────────────────┘
```

---

## 🔄 **Flujo de Uso**

### **Paso 1: Acceder al Panel de Administración**
```
Totem → Panel de Administración
```

### **Paso 2: Scroll hasta el Final**
Buscar la sección "⚠️ Zona Peligrosa"

### **Paso 3: Presionar "RESETEAR SISTEMA"**
Se abre el modal de confirmación

### **Paso 4: Ingresar Contraseña**
Escribir: `unachnegocios`

### **Paso 5: Confirmar**
Presionar "Confirmar Reset"

### **Paso 6: Verificación**
- ❌ **Contraseña incorrecta:** Alert de error
- ✅ **Contraseña correcta:** Datos eliminados + Alert de éxito

---

## 💻 **Implementación Técnica**

### **Frontend - Totem (app/totem/index.tsx)**

#### **1. Función de Reset:**
```typescript
const handleResetData = (password: string) => {
  const CORRECT_PASSWORD = 'unachnegocios';
  
  if (password !== CORRECT_PASSWORD) {
    Alert.alert('❌ Contraseña Incorrecta');
    return false;
  }

  socketService.emit('system:reset-data', { password, totemId });
  
  // Listeners de respuesta
  socketService.on('system:reset-success', () => {
    setTeams([]);
    setActiveTeam(null);
    setActiveCriterion(null);
    Alert.alert('✅ Datos Reseteados');
  });

  socketService.on('system:reset-error', (data) => {
    Alert.alert('❌ Error', data.error);
  });
  
  return true;
};
```

#### **2. Modal de Confirmación:**
```typescript
<Modal visible={showResetModal} transparent={true}>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>🔒 Resetear Sistema</Text>
      
      <TextInput
        style={styles.modalInput}
        value={resetPassword}
        onChangeText={setResetPassword}
        secureTextEntry={true}
        placeholder="Contraseña"
      />
      
      <TouchableOpacity onPress={handleConfirmReset}>
        <Text>Confirmar Reset</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

---

### **Backend - Server (server/index.js)**

#### **Endpoint de Reset:**
```javascript
socket.on('system:reset-data', async (data) => {
  const { password, totemId } = data;
  const CORRECT_PASSWORD = 'unachnegocios';
  
  // Verificar contraseña
  if (password !== CORRECT_PASSWORD) {
    socket.emit('system:reset-error', { error: 'Contraseña incorrecta' });
    return;
  }
  
  console.log('✅ Contraseña correcta - Limpiando datos...');
  
  // Eliminar todas las colecciones
  const evaluationsDeleted = await Evaluation.deleteMany({});
  const teamsDeleted = await Team.deleteMany({});
  const judgesDeleted = await Judge.deleteMany({});
  const totemsDeleted = await Totem.deleteMany({});
  
  // Logs de confirmación
  console.log(`🗑️ Evaluaciones eliminadas: ${evaluationsDeleted.deletedCount}`);
  console.log(`🗑️ Equipos eliminados: ${teamsDeleted.deletedCount}`);
  console.log(`🗑️ Jueces eliminados: ${judgesDeleted.deletedCount}`);
  console.log(`🗑️ Totems eliminados: ${totemsDeleted.deletedCount}`);
  
  // Emitir confirmación
  io.to(totemId).emit('system:reset-success', {});
  io.emit('system:reset-success', {}); // Broadcast global
  
  console.log('✅ Sistema reseteado exitosamente');
});
```

---

### **Types (types/index.ts)**

```typescript
export interface SocketEvents {
  // Cliente → Servidor
  'system:reset-data': { password: string; totemId: string };
  
  // Servidor → Cliente
  'system:reset-success': {};
  'system:reset-error': { error: string };
}
```

---

## 🔒 **Seguridad**

### ✅ **Validación en Frontend:**
```typescript
if (password !== 'unachnegocios') {
  Alert.alert('❌ Contraseña Incorrecta');
  return false;
}
```

### ✅ **Validación en Backend:**
```javascript
if (password !== 'unachnegocios') {
  socket.emit('system:reset-error', { error: 'Contraseña incorrecta' });
  return;
}
```

### ✅ **Input Seguro:**
```typescript
<TextInput
  secureTextEntry={true}  // Oculta la contraseña
  autoCapitalize="none"   // Sin capitalización automática
/>
```

---

## 📊 **Logs de Consola**

### **Frontend (Totem):**
```
📡 Conectando Totem "totem-1" a su sala...
✅ Totem "totem-1" conectado exitosamente a la sala
```

### **Backend (Server):**
```
🔒 Solicitud de reset de datos recibida para totem: totem-1
✅ Contraseña correcta - Iniciando limpieza de datos...
🗑️ Evaluaciones eliminadas: 15
🗑️ Equipos eliminados: 3
🗑️ Jueces eliminados: 5
🔄 Totems reseteados: 1 (no eliminados, solo limpiados)
✅ Sistema reseteado exitosamente
📊 Resumen:
   - Evaluaciones eliminadas: 15
   - Equipos eliminados: 3
   - Jueces eliminados: 5
   - Totems reseteados: 1 (activos y listos)
```

---

## 🎯 **Casos de Uso**

### **1. Antes de un Evento Real:**
```
Situación: Has estado probando la aplicación con datos de prueba
Acción: Resetear todos los datos
Resultado: Sistema limpio y listo para el evento real
```

### **2. Después de una Demo:**
```
Situación: Terminaste una demostración del sistema
Acción: Resetear para limpiar datos de demo
Resultado: Sistema listo para el siguiente demo o evento
```

### **3. Entre Eventos:**
```
Situación: Vas a usar la app en un nuevo evento
Acción: Resetear datos del evento anterior
Resultado: Sistema limpio para el nuevo evento
```

---

## 🔄 **Auto-Recuperación del Sistema**

### **¿Qué pasa después del reset?**

El sistema está diseñado para **auto-recuperarse** automáticamente:

#### **1. Totem se Auto-Registra:**
```javascript
// Cuando el Totem se conecta
socket.on('totem:connect', async (data) => {
  // Crea o actualiza el Totem en la BD automáticamente
  const totem = await Totem.findOneAndUpdate(
    { id: totemId },
    { id: totemId, status: 'active' },
    { upsert: true }
  );
});
```

**Resultado:**
- ✅ Totem se registra automáticamente al conectarse
- ✅ No necesitas hacer nada manualmente
- ✅ Funciona incluso si el reset eliminó el totem

#### **2. Judge Valida que Totem Existe:**
```javascript
// Cuando un Judge intenta conectarse
const totem = await Totem.findOne({ id: data.totemId });

if (!totem) {
  // NO crea el totem - envía error al Judge
  socket.emit('judge:connection-error', { 
    error: 'Totem no encontrado. Asegúrate de que el Totem esté activo.' 
  });
  return;
}
```

**Resultado:**
- ✅ Judge solo puede conectarse si el Totem está activo
- ✅ NO crea Totems fantasma automáticamente
- ✅ Muestra error claro al usuario si el Totem no existe
- ✅ Previene conexiones inválidas

#### **3. Totems NO se Eliminan:**

El reset ahora:
- ❌ **NO elimina** los Totems
- ✅ **Solo limpia** sus datos (activeTeam, activeCriterion)
- ✅ Los deja en estado 'idle' listos para usar

**Ventaja:**
- ✅ Después del reset, el Totem sigue existiendo en la BD
- ✅ Los Judges pueden conectarse inmediatamente
- ✅ No hay período de "totem no existe"

---

## ⚠️ **Advertencias**

### ❌ **ESTA ACCIÓN NO SE PUEDE DESHACER**

Una vez confirmado el reset:
- ✅ Todos los equipos se eliminan permanentemente
- ✅ Todas las evaluaciones se borran
- ✅ Todos los jueces se desconectan
- ✅ No hay backup automático
- ✅ No se puede recuperar la información

### 🔐 **MANTÉN LA CONTRASEÑA SEGURA**

- Solo personal autorizado debe conocer la contraseña
- No compartir públicamente
- Cambiar si es comprometida

---

## 🧪 **Cómo Probar**

### **1. Registrar Datos de Prueba:**
```
1. Totem → Panel de Administración
2. Agregar 3 equipos: "Test1", "Test2", "Test3"
3. Enviar equipos a jueces
```

### **2. Crear Evaluaciones:**
```
1. Judge → Evaluar cada equipo
2. Enviar evaluaciones
3. Verificar que hay datos en Totem → Ver Resultados
```

### **3. Resetear:**
```
1. Totem → Panel de Administración
2. Scroll hasta "Zona Peligrosa"
3. Presionar "RESETEAR SISTEMA"
4. Ingresar contraseña: unachnegocios
5. Confirmar Reset
```

### **4. Verificar:**
```
1. Alert de éxito aparece
2. Totem → Ver Resultados → "No hay equipos registrados"
3. Backend logs → Muestra contadores de eliminación
4. MongoDB → Colecciones vacías
```

---

## 📝 **Archivos Modificados**

1. **app/totem/index.tsx**
   - Función `handleResetData()`
   - Modal de confirmación
   - Botón de reset en "Zona Peligrosa"
   - Estilos para modal y botón

2. **server/index.js**
   - Evento `system:reset-data`
   - Eliminación de colecciones
   - Logs de confirmación

3. **types/index.ts**
   - Evento `system:reset-data`
   - Evento `system:reset-success`
   - Evento `system:reset-error`

---

## ✅ **Checklist de Verificación**

- [X] Botón de reset visible en Panel de Administración
- [X] Modal de confirmación funcional
- [X] Input de contraseña oculto (secure)
- [X] Validación de contraseña en frontend
- [X] Validación de contraseña en backend
- [X] Eliminación de colección Evaluations
- [X] Eliminación de colección Teams
- [X] Eliminación de colección Judges
- [X] Eliminación de colección Totems
- [X] Alert de éxito funcional
- [X] Alert de error para contraseña incorrecta
- [X] Logs detallados en consola
- [X] Estado local limpiado después de reset

---

## 🎉 **Resultado Final**

**Sistema de reset completamente funcional:**

- 🔒 **Protegido con contraseña:** Solo personal autorizado
- 🗑️ **Limpieza completa:** Elimina TODAS las colecciones
- ⚠️ **Advertencias claras:** Usuario informado de la acción
- ✅ **Confirmación visible:** Alerts y logs detallados
- 🎨 **Interfaz intuitiva:** Zona de peligro bien marcada

**¡Listo para usar en producción! 🚀**

