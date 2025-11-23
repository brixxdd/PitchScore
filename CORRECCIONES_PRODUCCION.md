# Correcciones Críticas para Producción

## Problemas Identificados

1. **Juez se desconecta y no recibe evaluaciones**: Cuando un juez pone modo ahorro de energía, al reconectar no recibe las evaluaciones que otros jueces ya recibieron.

2. **Pérdida de evaluaciones**: Si los jueces tardan en responder y el totem envía la siguiente encuesta, se pierde la valoración anterior.

3. **Falta de control de estado**: No se sabe qué jueces faltan por responder, y el totem puede enviar equipos sin esperar.

4. **Reconexión manual**: Si un juez se desconecta, debe escanear QR de nuevo, perdiendo tiempo.

## Soluciones a Implementar

### 1. Reconexión Automática de Jueces
- Guardar `judgeId` y `totemId` en AsyncStorage al conectar
- Al reconectar, verificar si hay datos guardados
- Reconectar automáticamente sin escanear QR
- Sincronizar estado perdido al reconectar

### 2. Sincronización de Estado
- Servidor: Mantener historial de equipos enviados a cada juez
- Servidor: Endpoint para obtener estado pendiente del juez
- Cliente: Solicitar estado pendiente al reconectar
- Cliente: Recibir equipos que se perdieron durante desconexión

### 3. Control de Estado de Evaluación
- Servidor: Rastrear qué jueces han respondido cada equipo
- Servidor: Campo en Team para tracking de evaluaciones por juez
- Servidor: No permitir enviar siguiente equipo si hay evaluaciones pendientes
- Totem: Mostrar lista de jueces que faltan por responder
- Totem: Deshabilitar botón "Enviar siguiente equipo" si hay pendientes

### 4. Prevenir Pérdida de Evaluaciones
- Servidor: Validar que no se puede enviar equipo nuevo si hay pendientes
- Servidor: Guardar evaluaciones parciales en cache
- Cliente: Guardar evaluación en progreso localmente
- Cliente: Reenviar evaluación si se perdió conexión

### 5. Panel de Administración
- Crear nueva pantalla 'admin' en totem (no es totem distinto)
- Panel puede enviar equipos desde ahí
- Panel puede ver estado de evaluaciones
- Totem siempre muestra tabla de posiciones

### 6. Mejor Manejo de Reconexión
- Detectar desconexión automáticamente
- Reconectar en background sin interrumpir al usuario
- Mantener estado local durante reconexión
- Sincronizar cambios al reconectar
- Sistema de heartbeat para mantener conexión activa

## Plan de Implementación

1. ✅ Checklist creado
2. ⏳ Modificar esquema de Team para rastrear evaluaciones por juez
3. ⏳ Implementar reconexión automática en app/judge/index.tsx
4. ⏳ Implementar sincronización de estado en servidor
5. ⏳ Implementar control de estado en totem
6. ⏳ Implementar panel de administración
7. ⏳ Mejorar manejo de reconexión

