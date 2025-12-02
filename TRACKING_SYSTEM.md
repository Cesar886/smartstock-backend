# 🚚 SISTEMA DE TRACKING Y GESTIÓN DE ENTREGAS

Sistema completo de rastreo de tarjetas desde que salen del inventario hasta que se activan.

## 📊 FLUJO COMPLETO DEL SISTEMA

```
1. PEDIDO CREADO → Estado: "pendiente_envio"
   ↓
2. ENVÍO DESPACHADO → Estado: "en_transito"
   - Se crea registro en tabla "envios"
   - Se asigna repartidor
   - Se genera tracking code
   - Se descuenta del inventario
   ↓
3. EN CAMINO → GPS tracking en tiempo real
   - Actualizar ubicación del repartidor
   - Cliente puede ver en mapa
   ↓
4. ENTREGADO → Estado: "entregado"
   - Repartidor confirma entrega
   - Sube foto de evidencia
   - Tarjetas pasan a "inactivas" (sin usar aún)
   ↓
5. ACTIVACIÓN → Tarjetas pasan de "inactivas" a "activas"
   - Cuando el empleado usa la tarjeta por primera vez
   - O cuando el cliente las asigna manualmente
```

## 🗄️ TABLAS UTILIZADAS

- ✅ **pedidos** - Estado del pedido
- ✅ **envios** - Tracking del envío
- ✅ **repartidores** - Datos del repartidor
- ✅ **tarjetas_fisicas** - Estado individual de cada tarjeta

## 🔌 API ENDPOINTS

### 📦 ENVÍOS

#### Crear un envío
```bash
POST /api/envios
Content-Type: application/json

{
  "pedido_id": 1,
  "repartidor_id": 1
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Envío creado exitosamente",
  "envio": {
    "id": 1,
    "pedido_id": 1,
    "repartidor_id": 1,
    "tracking_code": "TRACK-1733184000-ABC123XYZ",
    "status": "en_transito",
    "fecha_salida": "2025-12-02T10:30:00Z",
    "repartidor_nombre": "Juan Perez",
    "repartidor_telefono": "5512341234",
    "repartidor_vehiculo": "Moto Honda 125",
    "cantidad": 50,
    "cliente_nombre": "Empresa ABC",
    "producto_nombre": "Tarjeta Premium"
  }
}
```

#### Obtener envíos activos
```bash
GET /api/envios/activos
```

#### Obtener tracking por código
```bash
GET /api/envios/tracking/TRACK-1733184000-ABC123XYZ
```

**Respuesta:**
```json
{
  "id": 1,
  "tracking_code": "TRACK-1733184000-ABC123XYZ",
  "status": "en_transito",
  "fecha_salida": "2025-12-02T10:30:00Z",
  "ubicacion_actual_lat": 19.4326,
  "ubicacion_actual_lng": -99.1332,
  "repartidor_nombre": "Juan Perez",
  "repartidor_telefono": "5512341234",
  "repartidor_vehiculo": "Moto Honda 125",
  "cliente_nombre": "Empresa ABC",
  "cliente_direccion": "Av. Reforma 123",
  "producto_nombre": "Tarjeta Premium",
  "cantidad": 50
}
```

#### Actualizar ubicación GPS (para app del repartidor)
```bash
PUT /api/envios/1/ubicacion
Content-Type: application/json

{
  "latitud": 19.4326,
  "longitud": -99.1332
}
```

#### Marcar como entregado
```bash
PUT /api/envios/1/entregar
Content-Type: application/json

{
  "evidencia_foto_url": "https://ejemplo.com/fotos/entrega-123.jpg"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Pedido marcado como entregado",
  "envio_id": 1
}
```

#### Obtener envíos de un cliente
```bash
GET /api/envios/cliente/1
```

### 👷 REPARTIDORES

#### Obtener todos los repartidores disponibles
```bash
GET /api/repartidores
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "nombre": "Juan Perez",
    "telefono": "5512341234",
    "vehiculo": "Moto Honda 125",
    "status": "disponible"
  },
  {
    "id": 2,
    "nombre": "Pedro Ramirez",
    "telefono": "5543214321",
    "vehiculo": "Van Nissan",
    "status": "disponible"
  }
]
```

#### Crear un repartidor
```bash
POST /api/repartidores
Content-Type: application/json

{
  "nombre": "María González",
  "telefono": "5555551234",
  "vehiculo": "Camioneta Ford"
}
```

#### Obtener envíos asignados a un repartidor
```bash
GET /api/repartidores/1/envios
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "tracking_code": "TRACK-1733184000-ABC123XYZ",
    "status": "en_transito",
    "fecha_salida": "2025-12-02T10:30:00Z",
    "cantidad": 50,
    "cliente_nombre": "Empresa ABC",
    "cliente_direccion": "Av. Reforma 123",
    "cliente_telefono": "5555551111",
    "producto_nombre": "Tarjeta Premium"
  }
]
```

## 🎯 CASOS DE USO

### 1. Crear un pedido y asignar repartidor

```bash
# Paso 1: Crear pedido (estado inicial: pendiente_envio)
POST /api/pedidos
{
  "contrato_id": 1,
  "cantidad": 50
}

# Paso 2: Crear envío y asignar repartidor
POST /api/envios
{
  "pedido_id": 1,
  "repartidor_id": 1
}
# El estado del pedido cambia automáticamente a: en_transito
```

### 2. Tracking en tiempo real (App del repartidor)

```bash
# El repartidor actualiza su ubicación cada 30 segundos
PUT /api/envios/1/ubicacion
{
  "latitud": 19.4326,
  "longitud": -99.1332
}
```

### 3. Confirmar entrega

```bash
# El repartidor marca como entregado y sube foto
PUT /api/envios/1/entregar
{
  "evidencia_foto_url": "https://s3.amazonaws.com/entregas/foto-123.jpg"
}
# El estado del pedido cambia a: entregado
```

### 4. Cliente consulta tracking

```bash
# El cliente puede ver el estado de su pedido
GET /api/envios/tracking/TRACK-1733184000-ABC123XYZ

# O ver todo su historial de envíos
GET /api/envios/cliente/1
```

## 🔄 ESTADOS DE LOS PEDIDOS

| Estado | Descripción |
|--------|-------------|
| `pendiente_envio` | Pedido creado, esperando asignación de repartidor |
| `en_transito` | Envío en camino, repartidor asignado |
| `entregado` | Paquete entregado al cliente |

## 🔄 ESTADOS DE LOS ENVÍOS

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Envío creado pero no ha salido |
| `en_transito` | Repartidor en camino |
| `entregado` | Entrega confirmada con evidencia |

## 🗺️ TRACKING GPS

El sistema almacena la ubicación actual del repartidor en:
- `ubicacion_actual_lat` - Latitud
- `ubicacion_actual_lng` - Longitud

Estos campos se actualizan en tiempo real desde la app del repartidor.

## 📱 INTEGRACIONES RECOMENDADAS

### Frontend (React/Vue/Angular)
- Usar Google Maps o Mapbox para mostrar la ubicación
- Actualizar el mapa cada 30 segundos
- Mostrar ruta estimada y tiempo de llegada

### App del Repartidor (React Native / Flutter)
- Obtener GPS del dispositivo
- Enviar ubicación cada 30 segundos
- Botón para marcar como entregado
- Cámara para subir foto de evidencia

### Notificaciones
- Enviar SMS/Email cuando el envío sale
- Notificar al cliente cuando está cerca
- Confirmar entrega con foto

## ✅ SISTEMA COMPLETADO

El sistema está listo para usar. Todos los endpoints están funcionando y las tablas de base de datos están configuradas correctamente.

### 📦 **Opciones de Envío Disponibles:**

#### 🚗 Repartidor Local
- **Repartidor Local** (ID: 6) - Para entregas locales inmediatas

#### 📮 Paqueterías Nacionales e Internacionales
- **DHL Express** (ID: 7) - Envíos nacionales e internacionales express
- **Estafeta** (ID: 8) - Paquetería nacional mexicana
- **UPS** (ID: 9) - Servicio internacional de paquetería
- **FedEx** (ID: 10) - Envíos express nacionales e internacionales
- **Redpack** (ID: 11) - Paquetería nacional mexicana
- **Paquetexpress** (ID: 12) - Envíos económicos nacionales
- **99 Minutos** (ID: 13) - Entregas el mismo día
- **Sendex** (ID: 14) - Paquetería nacional mexicana

### 💡 **Recomendaciones de Uso:**

- **Entregas locales urgentes:** Usar Repartidor Local o 99 Minutos
- **Envíos nacionales estándar:** Estafeta, Redpack, Sendex
- **Envíos express:** DHL Express, FedEx
- **Envíos internacionales:** DHL Express, UPS, FedEx
- **Envíos económicos:** Paquetexpress, Estafeta
