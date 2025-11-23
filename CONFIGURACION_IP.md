# 🌐 Cómo Cambiar la IP del Servidor

## 📍 IP Actual Detectada
Tu computadora actualmente tiene la IP: **`192.168.1.76`**

---

## 🔧 Pasos para Cambiar la IP

### 1️⃣ Crear archivo `.env`
En la raíz del proyecto (donde está `package.json`), crea un archivo llamado **`.env`**

### 2️⃣ Agregar la configuración
Dentro del archivo `.env`, escribe:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.76:3001
```

### 3️⃣ Cuando vayas a tu facultad:

#### a) Obtén la nueva IP de tu computadora:
```bash
# En Windows (CMD o PowerShell):
ipconfig

# Busca la línea que dice "Dirección IPv4"
# Por ejemplo: 192.168.1.76
```

#### b) Actualiza el archivo `.env` con la nueva IP:
```bash
# Si tu nueva IP es 10.0.0.50
EXPO_PUBLIC_API_URL=http://10.0.0.50:3001
```

#### c) Reinicia Expo:
```bash
npx expo start --clear
```

---

## ⚙️ Estructura del archivo `.env`

Crea el archivo `.env` en la raíz con este contenido:

```bash
# 🌐 Configuración de Red
# Cambia la IP según tu red actual

EXPO_PUBLIC_API_URL=http://192.168.1.76:3001

# Ejemplos para diferentes ubicaciones:
# Casa:         EXPO_PUBLIC_API_URL=http://192.168.1.76:3001
# Universidad:  EXPO_PUBLIC_API_URL=http://10.0.0.50:3001
# Oficina:      EXPO_PUBLIC_API_URL=http://172.16.0.10:3001
```

---

## ✅ Checklist Antes de Usar en la Facultad

- [ ] Conecta tu computadora y móviles a la **MISMA red WiFi**
- [ ] Obtén la **IP de tu computadora** con `ipconfig`
- [ ] Crea/actualiza el archivo **`.env`** con la nueva IP
- [ ] Inicia el **servidor backend**: `cd server && npm start`
- [ ] Reinicia **Expo** con: `npx expo start --clear`
- [ ] Verifica que el servidor esté en: `http://TU_IP:3001`

---

## 🚨 Importante

### ❌ NO usar en dispositivos físicos:
```bash
http://localhost:3001  # Solo funciona en emulador
```

### ✅ Usar tu IP real:
```bash
http://192.168.1.76:3001   # Funciona en móviles
```

### 🔥 El puerto siempre es **3001**
No cambies el puerto, solo la IP.

---

## 📱 Ejemplo Completo de Configuración

### En tu casa (red actual):
```bash
# .env
EXPO_PUBLIC_API_URL=http://192.168.1.76:3001
```

### En la facultad (ejemplo):
```bash
# .env
EXPO_PUBLIC_API_URL=http://10.50.20.100:3001
```

---

## 🔍 Verificar que funciona

1. Abre la app en Expo Go
2. En la consola de Expo deberías ver:
   ```
   ✅ Socket conectado
   📡 Conectando Totem...
   ```

3. Si ves errores como:
   ```
   ❌ Error de conexión
   ```
   
   **Verifica:**
   - ¿Tu móvil y PC están en la misma WiFi?
   - ¿La IP en `.env` es correcta?
   - ¿El servidor backend está corriendo?

---

## 📞 ¿Cómo encontrar tu IP?

### Windows:
```bash
ipconfig
```
Busca: `Dirección IPv4`

### Mac/Linux:
```bash
ifconfig
```
Busca: `inet`

### En la App:
El IP aparece en la URL de Expo, por ejemplo:
```
exp://192.168.1.76:8081
```

---

## 💡 Tip Pro

Puedes crear múltiples archivos de configuración:

```bash
.env.casa          # Para tu casa
.env.facultad      # Para la facultad
.env.produccion    # Para eventos
```

Y copiar el que necesites:
```bash
# En Windows:
copy .env.facultad .env

# En Mac/Linux:
cp .env.facultad .env
```

Luego reinicia Expo con: `npx expo start --clear`

