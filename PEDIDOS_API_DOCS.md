# 📦 Documentación API de Pedidos - SmartStock

## ✅ Sistema Completamente Implementado

El sistema de pedidos ahora incluye:
- ✅ Validación de stock antes de crear pedidos
- ✅ Descuento automático de inventario
- ✅ Actualización de contratos (tarjetas emitidas)
- ✅ Transacciones para garantizar integridad de datos
- ✅ Rollback automático en caso de errores
- ✅ Manejo robusto de errores con mensajes claros

---

## 🔌 Endpoints Disponibles

### 1. Crear Pedido (Método Principal)

**Endpoint:** `POST /api/pedidos`

**Descripción:** Crea un pedido con validación automática y descuenta el stock del inventario.

**Payload:**
```json
{
  "contrato_id": 1,
  "cantidad": 50
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "✅ Pedido creado exitosamente. Stock descontado y reservado.",
  "pedido": {
    "id": 123,
    "contrato_id": 1,
    "cantidad": 50,
    "estado": "pendiente_envio",
    "estado_inventario": "reservado",
    "fecha_solicitud": "2025-12-02T10:30:00.000Z",
    "fecha_aprobacion": "2025-12-02T10:30:00.000Z"
  },
  "inventario": {
    "disponible_antes": 1000,
    "disponible_ahora": 950,
    "en_transito": 50
  },
  "stock": {
    "producto": "Tarjeta Vales",
    "stock_anterior": 1000,
    "stock_actual": 950,
    "cantidad_descontada": 50
  },
  "contrato": {
    "tarjetas_antes": 200,
    "tarjetas_despues": 250
  }
}
```

**Errores Posibles:**

1. **Stock Insuficiente (400):**
```json
{
  "error": "Stock insuficiente",
  "disponible": 30,
  "solicitado": 50,
  "faltante": 20
}
```

2. **Pedido No Puede Ser Aprobado (400):**
```json
{
  "error": "Pedido no puede ser aprobado",
  "razon": "El contrato ha alcanzado su límite de tarjetas"
}
```

3. **Contrato No Encontrado (404):**
```json
{
  "error": "Contrato no encontrado"
}
```

---

### 2. Crear Pedido Simple (Método Alternativo)

**Endpoint:** `POST /api/pedidos/simple`

**Descripción:** Versión simplificada que acepta `cliente_id` y `producto_id` directamente. El sistema buscará automáticamente el contrato activo correspondiente.

**Payload - Opción 1 (con cliente_id y producto_id):**
```json
{
  "cliente_id": 5,
  "producto_id": 2,
  "cantidad": 100
}
```

**Payload - Opción 2 (con contrato_id):**
```json
{
  "contrato_id": 1,
  "cantidad": 100
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Pedido creado exitosamente",
  "pedido_id": 456,
  "pedido": {
    "id": 456,
    "contrato_id": 1,
    "cliente": "Empresa ABC S.A.",
    "producto": "Tarjeta Sodexo",
    "cantidad": 100,
    "estado": "pendiente_envio",
    "fecha_solicitud": "2025-12-02T11:00:00.000Z"
  },
  "inventario": {
    "stock_anterior": 5000,
    "stock_actual": 4900,
    "stock_restante": 4900
  },
  "contrato": {
    "tarjetas_antes": 500,
    "tarjetas_despues": 600,
    "tarjetas_disponibles": 900
  }
}
```

**Errores Posibles:**

1. **No Se Encontró Contrato Activo (404):**
```json
{
  "error": "No se encontró un contrato activo para este cliente y producto"
}
```

2. **Excede Límite del Contrato (400):**
```json
{
  "error": "Excede el límite del contrato",
  "tarjetas_maximas": 1000,
  "tarjetas_emitidas": 950,
  "disponibles": 50,
  "solicitadas": 100
}
```

3. **Contrato No Activo (400):**
```json
{
  "error": "El contrato no está activo",
  "estado_actual": "vencido"
}
```

---

### 3. Validar Pedido (Pre-validación)

**Endpoint:** `POST /api/pedidos/validar`

**Descripción:** Valida si un pedido puede ser creado sin crearlo realmente. Útil para validar antes de enviar el pedido final.

**Payload:**
```json
{
  "contratoId": 1,
  "cantidad": 75
}
```

**Respuesta:**
```json
{
  "puede_aprobar": true,
  "razon": null
}
```

---

### 4. Obtener Todos los Pedidos

**Endpoint:** `GET /api/pedidos`

**Respuesta:**
```json
[
  {
    "id": 1,
    "contrato_id": 5,
    "cantidad": 100,
    "estado": "pendiente_envio",
    "fecha_solicitud": "2025-12-01T10:00:00.000Z",
    "cliente_nombre": "Empresa XYZ",
    "producto_nombre": "Tarjeta Vales"
  }
]
```

---

## 🔒 Características de Seguridad Implementadas

### Transacciones Atómicas
Todas las operaciones se ejecutan dentro de transacciones:
```javascript
BEGIN TRANSACTION
  1. Validar stock
  2. Crear pedido
  3. Descontar stock
  4. Actualizar contrato
  5. Registrar historial
COMMIT (o ROLLBACK si hay error)
```

### Bloqueo de Filas (Row Locking)
```sql
SELECT ... FROM contratos WHERE id = $1 FOR UPDATE
```
Previene condiciones de carrera cuando múltiples pedidos se crean simultáneamente.

### Validaciones en Cascada
1. ✅ Stock suficiente
2. ✅ Contrato activo
3. ✅ Límites del contrato
4. ✅ Parámetros válidos

---

## 🧪 Testing y Verificación

### Consultas SQL Útiles

#### 1. Ver Stock Actual de Productos
```sql
SELECT 
  id, 
  nombre, 
  stock_actual, 
  stock_minimo,
  ultima_actualizacion
FROM productos
ORDER BY stock_actual ASC;
```

#### 2. Ver Últimos Pedidos Creados
```sql
SELECT 
  p.id,
  p.cantidad,
  p.estado,
  p.fecha_solicitud,
  c.nombre as cliente,
  pr.nombre as producto,
  con.tarjetas_emitidas
FROM pedidos p
JOIN contratos con ON p.contrato_id = con.id
JOIN clientes c ON con.cliente_id = c.id
JOIN productos pr ON con.producto_id = pr.id
ORDER BY p.fecha_solicitud DESC
LIMIT 10;
```

#### 3. Ver Historial de Movimientos de Stock
```sql
SELECT 
  h.*,
  p.nombre as producto
FROM historial_stock h
JOIN productos p ON h.producto_id = p.id
ORDER BY h.fecha DESC
LIMIT 20;
```

#### 4. Ver Estado de un Contrato Específico
```sql
SELECT 
  c.*,
  cl.nombre as cliente_nombre,
  p.nombre as producto_nombre,
  p.stock_actual,
  c.tarjetas_maximas - c.tarjetas_emitidas as tarjetas_disponibles,
  ROUND((c.tarjetas_activas::DECIMAL / NULLIF(c.tarjetas_emitidas, 0) * 100), 2) as porcentaje_uso
FROM contratos c
JOIN clientes cl ON c.cliente_id = cl.id
JOIN productos p ON c.producto_id = p.id
WHERE c.id = 1;
```

#### 5. Verificar Integridad del Sistema
```sql
-- Comparar stock en productos vs estados_inventario
SELECT 
  p.id,
  p.nombre,
  p.stock_actual as stock_productos,
  ei.stock_disponible + ei.stock_en_transito as stock_inventario,
  p.stock_actual - (ei.stock_disponible + ei.stock_en_transito) as diferencia
FROM productos p
LEFT JOIN estados_inventario ei ON p.id = ei.producto_id;
```

---

## 📊 Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────┐
│  1. Frontend: Usuario crea pedido              │
│     - Selecciona cliente y productos            │
│     - Valida RFC                                │
│     - Ingresa cantidades                        │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  2. Frontend envía: POST /api/pedidos           │
│     Payload: { contrato_id, cantidad }          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  3. Backend: Inicia transacción                 │
│     BEGIN TRANSACTION                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  4. Validar stock disponible                    │
│     ✓ Stock >= cantidad solicitada              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  5. Crear registro en tabla pedidos             │
│     estado: 'pendiente_envio'                   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  6. Descontar stock                             │
│     UPDATE productos                            │
│     SET stock_actual = stock_actual - cantidad  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  7. Actualizar contrato                         │
│     tarjetas_emitidas += cantidad               │
│     tarjetas_inactivas += cantidad              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  8. Registrar en historial                      │
│     INSERT INTO historial_stock                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  9. COMMIT transacción                          │
│     Todos los cambios se confirman              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  10. Respuesta exitosa al frontend              │
│      { success: true, pedido_id, stock_actual } │
└─────────────────────────────────────────────────┘
```

---

## 🧪 Escenarios de Prueba

### Test 1: Pedido Normal
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "contrato_id": 1,
    "cantidad": 50
  }'
```

**Resultado esperado:** 
- ✅ Pedido creado
- ✅ Stock descontado: `-50`
- ✅ Tarjetas emitidas: `+50`

---

### Test 2: Stock Insuficiente
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "contrato_id": 1,
    "cantidad": 99999
  }'
```

**Resultado esperado:**
```json
{
  "error": "Stock insuficiente",
  "disponible": 500,
  "solicitado": 99999,
  "faltante": 99499
}
```

---

### Test 3: Pedidos Simultáneos
Ejecuta 5 pedidos al mismo tiempo para el mismo producto:

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -d '{"contrato_id": 1, "cantidad": 10}' &
done
wait
```

**Resultado esperado:**
- ✅ Todos los pedidos se procesan correctamente
- ✅ Stock se descuenta exactamente 50 unidades (5 × 10)
- ✅ No hay condiciones de carrera

---

### Test 4: Pedido Simple con Cliente y Producto
```bash
curl -X POST http://localhost:3000/api/pedidos/simple \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 5,
    "producto_id": 2,
    "cantidad": 100
  }'
```

---

## 🔧 Configuración del Servidor

Asegúrate de tener las variables de entorno configuradas en `.env`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=smartstock
DB_PASSWORD=tu_password
DB_PORT=5432
PORT=3000
```

---

## 🚀 Iniciar el Servidor

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

---

## 📝 Notas Importantes

1. **Todas las operaciones son atómicas**: Si algo falla, todo se revierte automáticamente
2. **El stock se descuenta inmediatamente**: No espera aprobación manual
3. **Los pedidos se crean con estado `pendiente_envio`**: Listos para ser procesados por el sistema de envíos
4. **El historial se registra automáticamente**: Para auditoría y trazabilidad
5. **Las validaciones son exhaustivas**: Múltiples capas de validación antes de crear el pedido

---

## ✅ Checklist de Implementación Completada

- [x] Validación de stock antes de crear pedido
- [x] Descuento automático de inventario
- [x] Actualización de tarjetas emitidas en contratos
- [x] Transacciones para garantizar integridad
- [x] Bloqueo de filas (FOR UPDATE) para prevenir race conditions
- [x] Rollback automático en caso de error
- [x] Manejo robusto de errores
- [x] Registro en historial de stock
- [x] Validación de límites de contrato
- [x] Endpoint alternativo simplificado
- [x] Documentación completa
- [x] Queries de verificación SQL

---

## 🆘 Soporte

Para problemas o dudas, revisar:
1. Logs del servidor: `console.error` mostrará detalles de errores
2. Estado de la base de datos con las queries de verificación
3. Respuestas HTTP con códigos de estado apropiados
