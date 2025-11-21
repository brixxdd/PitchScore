# 🎨 Rediseño de UI - PitchScore

## 🌟 Nuevo Esquema de Colores

### **Color Principal: `#5dbba7`** (Verde Azulado)

Este color se utiliza como tema principal en toda la aplicación, creando una identidad visual moderna y profesional.

### **Paleta de Colores:**

```
🎨 Colores Principales:
- Principal:     #5dbba7  (Verde azulado vibrante)
- Oscuro:        #0a2f2a  (Verde oscuro - fondos)
- Medio:         #3a9989  (Verde medio - variaciones)
- Claro:         #a0d9cd  (Verde claro - acentos)
- Muy Claro:     #e0f7f3  (Verde pastel - fondos secundarios)
- Background:    #e8f5f2  (Gris verdoso - fondos)

🏆 Colores Especiales:
- Primer Lugar:  #FFD700  (Oro)
- Alerta:        #ff6b6b  (Rojo - zona peligrosa)
- Blanco:        #ffffff  (Cards y contenedores)
```

## 📱 Pantalla Principal (`app/index.tsx`)

### **Antes:**
- Gradiente naranja/amarillo (#fbe249, #f4a261, #e76f51)
- Botones verde y rojo
- Diseño básico

### **Ahora:**
```tsx
<LinearGradient
  colors={['#0a2f2a', '#1a4d44', '#2a6a5e']}  // Gradiente verde oscuro
  style={styles.container}
/>
```

#### **Botones:**
- **Modo Totem:** Gradiente verde claro `['#5dbba7', '#7fd1bf']`
- **Modo Juez:** Gradiente verde medio `['#3a9989', '#5dbba7']`

## 📺 Pantalla Totem

### **1. Welcome Screen (QR Display)**

#### **Contenedor Principal:**
```tsx
welcomeContainer: {
  backgroundColor: '#0a2f2a',  // Verde oscuro profundo
  textShadowColor: 'rgba(93, 187, 167, 0.3)',  // Sombra verde
}
```

#### **QR Container:**
```tsx
qrContainer: {
  backgroundColor: '#ffffff',
  borderWidth: 3,
  borderColor: '#5dbba7',
  shadowColor: '#5dbba7',  // Sombra del color principal
  shadowOpacity: 0.4,
  shadowRadius: 15,
  padding: 35,
  borderRadius: 25,
}
```

**Características:**
- ✨ Borde verde vibrante (#5dbba7)
- 🌟 Sombra verde brillante
- 📏 Padding aumentado para más espacio
- 🔄 Bordes más redondeados (25px)

#### **Botones de Navegación:**
```tsx
adminButton: {
  backgroundColor: '#5dbba7',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.5,
  borderRadius: 15,
  padding: 20,
}

resultsButton: {
  backgroundColor: '#3a9989',
  borderWidth: 2,
  borderColor: '#5dbba7',
}
```

### **2. Panel de Administración**

#### **Header:**
```tsx
adminHeader: {
  backgroundColor: '#5dbba7',
  padding: 25,
  shadowColor: '#5dbba7',
  shadowOpacity: 0.3,
}
```

#### **Secciones:**
```tsx
section: {
  backgroundColor: '#fff',
  padding: 25,
  borderRadius: 20,
  borderLeftWidth: 5,
  borderLeftColor: '#5dbba7',  // Barra lateral verde
  shadowColor: '#5dbba7',
  shadowOpacity: 0.15,
}
```

**Características:**
- 📍 Barra lateral izquierda verde (#5dbba7) de 5px
- 💫 Sombras sutiles verde
- 🔄 Bordes más redondeados (20px)
- 📏 Más padding para mejor espaciado

#### **Inputs:**
```tsx
textInput: {
  backgroundColor: '#f8fcfb',
  borderWidth: 2,
  borderColor: '#a0d9cd',  // Verde claro
  borderRadius: 12,
  padding: 15,
}
```

#### **Botones de Acción:**
```tsx
addButton: {
  backgroundColor: '#5dbba7',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.3,
  borderRadius: 12,
  padding: 18,
}

sendButton: {
  backgroundColor: '#5dbba7',
  shadowColor: '#5dbba7',
}
```

#### **Lista de Equipos:**
```tsx
teamItem: {
  backgroundColor: '#f8fcfb',
  borderWidth: 2,
  borderColor: '#e0f2ee',
  borderRadius: 15,
  padding: 18,
}

teamItemActive: {
  backgroundColor: '#e0f7f3',
  borderWidth: 3,
  borderColor: '#5dbba7',  // Borde verde para equipo activo
}
```

#### **Zona de Reset:**
```tsx
dangerZone: {
  backgroundColor: '#ffe6e6',
  borderWidth: 3,
  borderColor: '#ff6b6b',  // Rojo para peligro
  shadowColor: '#ff6b6b',
  borderRadius: 20,
  padding: 25,
}
```

### **3. Pantalla de Resultados**

#### **Header:**
```tsx
resultsHeader: {
  backgroundColor: '#5dbba7',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.3,
}
```

#### **Items de Resultados:**
```tsx
resultItem: {
  backgroundColor: '#fff',
  padding: 25,
  borderRadius: 20,
  borderLeftWidth: 5,
  borderLeftColor: '#a0d9cd',  // Barra lateral verde claro
  shadowColor: '#5dbba7',
  shadowOpacity: 0.15,
}
```

#### **Primer Lugar:**
```tsx
firstPlace: {
  backgroundColor: '#fffbf0',
  borderWidth: 4,
  borderColor: '#FFD700',  // Oro
  borderLeftWidth: 8,
  borderLeftColor: '#FFD700',
  shadowColor: '#FFD700',  // Sombra dorada
  shadowOpacity: 0.3,
}
```

**Características:**
- 🏆 Borde dorado de 4px
- ⭐ Barra lateral dorada de 8px
- ✨ Sombra dorada brillante
- 🌟 Fondo crema (#fffbf0)

#### **Badge de Posición:**
```tsx
positionBadge: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: '#5dbba7',
  borderWidth: 3,
  borderColor: '#fff',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.4,
}
```

**Características:**
- 🔵 Círculo verde (#5dbba7)
- ⚪ Borde blanco de 3px
- 💫 Sombra verde
- 📏 Tamaño aumentado (60x60)

## ⚖️ Pantalla Judge

### **Header:**
```tsx
header: {
  backgroundColor: '#5dbba7',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.3,
  padding: 25,
}
```

### **Cards de Criterios:**
```tsx
criterionCard: {
  backgroundColor: '#fff',
  padding: 25,
  borderRadius: 20,
  borderLeftWidth: 5,
  borderLeftColor: '#a0d9cd',
  shadowColor: '#5dbba7',
  shadowOpacity: 0.15,
}
```

### **Botón de Envío:**
```tsx
submitButton: {
  backgroundColor: '#5dbba7',
  padding: 22,
  borderRadius: 15,
  shadowColor: '#5dbba7',
  shadowOpacity: 0.4,
}
```

## 🎨 Elementos de Diseño Comunes

### **1. Sombras:**
```tsx
// Sombras verdes en elementos principales
shadowColor: '#5dbba7',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.3,
shadowRadius: 8,
elevation: 6,  // Para Android
```

### **2. Bordes Redondeados:**
- Cards: `borderRadius: 20`
- Botones: `borderRadius: 15`
- Inputs: `borderRadius: 12`

### **3. Barras Laterales:**
```tsx
borderLeftWidth: 5,
borderLeftColor: '#5dbba7',
```
Usadas en:
- Secciones del admin panel
- Cards de criterios
- Items de resultados

### **4. Spacing:**
- Padding aumentado en todos los elementos: `20-25px`
- Margins más generosos: `15px`
- Gap entre botones: `24px`

## 📊 Jerarquía Visual

### **Nivel 1 - Headers:**
- Color: `#5dbba7`
- Sombra: Verde intensa
- Elevation: 6

### **Nivel 2 - Cards/Secciones:**
- Background: `#fff`
- Borde lateral: `#5dbba7`
- Sombra: Verde suave
- Elevation: 4

### **Nivel 3 - Items:**
- Background: `#f8fcfb`
- Borde: `#e0f2ee`
- Sombra: Muy suave
- Elevation: 2

## ✨ Efectos Especiales

### **1. Text Shadows:**
```tsx
textShadowColor: 'rgba(93, 187, 167, 0.3)',
textShadowOffset: { width: 0, height: 4 },
textShadowRadius: 10,
```

### **2. Gradientes:**
- **Pantalla principal:** `['#0a2f2a', '#1a4d44', '#2a6a5e']`
- **Botón Totem:** `['#5dbba7', '#7fd1bf']`
- **Botón Judge:** `['#3a9989', '#5dbba7']`

### **3. Estados Activos:**
- Borde más grueso: `borderWidth: 3`
- Color principal: `#5dbba7`
- Background más claro: `#e0f7f3`
- Sombra más intensa: `shadowOpacity: 0.4`

## 🎯 Ventajas del Nuevo Diseño

1. **✨ Cohesión Visual:** Color consistente en toda la app
2. **🎨 Profesional:** Paleta moderna y agradable
3. **👁️ Legibilidad:** Contraste mejorado
4. **💫 Profundidad:** Sombras y elevaciones bien definidas
5. **🔍 Jerarquía Clara:** Elementos importantes destacan
6. **📱 Moderna:** Bordes redondeados y espaciado generoso
7. **🌟 Distintiva:** Barra lateral verde identifica secciones
8. **⚡ Energética:** Color verde vibrante transmite dinamismo

## 📝 Notas de Implementación

- Todos los colores usan la paleta definida
- Sombras usan el color principal (#5dbba7) para cohesión
- Primer lugar mantiene el dorado (#FFD700) para destacar
- Zona peligrosa usa rojo (#ff6b6b) para alertar
- Fondos usan tonos muy claros (#e8f5f2) para no cansar la vista
- Textos principales en verde oscuro (#0a2f2a) para contraste

---

**Última actualización:** 2025-11-21  
**Color Principal:** #5dbba7 (Verde Azulado)

