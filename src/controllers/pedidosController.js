import { query, getClient } from '../config/database.js';

// Validar un pedido
export const validarPedido = async (req, res) => {
  try {
    const { contratoId, cantidad } = req.body;
    
    if (!contratoId || !cantidad) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    
    // Llamar a la función de PostgreSQL
    const result = await query(
      'SELECT * FROM validar_pedido($1, $2)',
      [contratoId, cantidad]
    );
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Error en la validación' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al validar pedido:', error);
    res.status(500).json({ error: 'Error al validar pedido' });
  }
};

// Crear un pedido (CON APROBACIÓN AUTOMÁTICA)
export const crearPedido = async (req, res) => {
  try {
    const { contrato_id, cantidad } = req.body;
    
    if (!contrato_id || !cantidad) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    
    // 1. VALIDAR el pedido
    const validacion = await query(
      'SELECT * FROM validar_pedido($1, $2)',
      [contrato_id, cantidad]
    );
    
    if (!validacion.rows[0].puede_aprobar) {
      return res.status(400).json({ 
        error: 'Pedido no puede ser aprobado',
        razon: validacion.rows[0].razon
      });
    }
    
    // 2. OBTENER información del contrato y producto
    const contratoInfo = await query(`
      SELECT 
        c.*,
        p.id as producto_id,
        p.nombre as producto_nombre,
        ROUND((c.tarjetas_activas::DECIMAL / NULLIF(c.tarjetas_emitidas, 0) * 100), 2) as porcentaje_uso
      FROM contratos c
      JOIN productos p ON p.id = c.producto_id
      WHERE c.id = $1
    `, [contrato_id]);
    
    if (contratoInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const contrato = contratoInfo.rows[0];
    
    // 3. OBTENER stock actual ANTES de descontar
    const stockAntes = await query(
      'SELECT stock_actual FROM productos WHERE id = $1',
      [contrato.producto_id]
    );
    
    if (stockAntes.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const stockActual = stockAntes.rows[0].stock_actual;
    const stockDespues = stockActual - cantidad;
    
    // 4. CREAR pedido CON ESTADO PENDIENTE_ENVIO Y ESTADO_INVENTARIO RESERVADO
    const pedido = await query(
      `INSERT INTO pedidos (
        contrato_id, 
        cantidad, 
        estado,
        estado_inventario,
        fecha_aprobacion,
        aprobado_por,
        porcentaje_uso_momento_pedido,
        tarjetas_inactivas_momento_pedido
      )
      VALUES ($1, $2, 'pendiente_envio', 'reservado', CURRENT_TIMESTAMP, NULL, $3, $4)
      RETURNING *`,
      [
        contrato_id, 
        cantidad, 
        contrato.porcentaje_uso,
        contrato.tarjetas_inactivas
      ]
    );
    
    // 5. ACTUALIZAR contrato (incrementar tarjetas)
    await query(
      `UPDATE contratos
       SET tarjetas_emitidas = tarjetas_emitidas + $1,
           tarjetas_inactivas = tarjetas_inactivas + $1
       WHERE id = $2`,
      [cantidad, contrato_id]
    );
    
    // 6. ACTUALIZAR ESTADOS DE INVENTARIO
    await query(
      `UPDATE estados_inventario
       SET stock_disponible = stock_disponible - $1,
           stock_en_transito = stock_en_transito + $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE producto_id = $2`,
      [cantidad, contrato.producto_id]
    );
    
    // 7. DESCONTAR stock del producto (para mantener compatibilidad)
    await query(
      `UPDATE productos
       SET stock_actual = stock_actual - $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [cantidad, contrato.producto_id]
    );
    
    // 8. REGISTRAR en historial de stock
    await query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, 'pedido', NULL)`,
      [contrato.producto_id, stockActual, stockDespues]
    );
    
    // 9. RESPONDER con éxito
    res.status(201).json({
      success: true,
      message: '✅ Pedido creado. Inventario reservado.',
      pedido: {
        id: pedido.rows[0].id,
        contrato_id: contrato_id,
        cantidad: cantidad,
        estado: 'pendiente_envio',
        estado_inventario: 'reservado',
        fecha_solicitud: pedido.rows[0].fecha_solicitud,
        fecha_aprobacion: pedido.rows[0].fecha_aprobacion
      },
      inventario: {
        disponible_antes: stockActual,
        disponible_ahora: stockDespues,
        en_transito: cantidad
      },
      stock: {
        producto: contrato.producto_nombre,
        stock_anterior: stockActual,
        stock_actual: stockDespues,
        cantidad_descontada: cantidad
      },
      contrato: {
        tarjetas_antes: contrato.tarjetas_emitidas,
        tarjetas_despues: contrato.tarjetas_emitidas + cantidad
      }
    });
    
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el pedido',
      details: error.message 
    });
  }
};

// Obtener todos los pedidos
export const getAllPedidos = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        cl.nombre as cliente_nombre,
        pr.nombre as producto_nombre
      FROM pedidos p
      JOIN contratos c ON c.id = p.contrato_id
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos pr ON pr.id = c.producto_id
      ORDER BY p.fecha_solicitud DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

// Aprobar un pedido
export const aprobarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;
    
    // Obtener información del pedido
    const pedido = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    
    if (pedido.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    if (pedido.rows[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'El pedido ya fue procesado' });
    }
    
    // Obtener información del contrato
    const contrato = await query('SELECT * FROM contratos WHERE id = $1', [pedido.rows[0].contrato_id]);
    
    // ✅ AHORA SÍ ACTUALIZAR TODO
    
    // 1. Actualizar pedido
    await query(
      `UPDATE pedidos 
       SET estado = 'aprobado', 
           fecha_aprobacion = CURRENT_TIMESTAMP,
           aprobado_por = $1
       WHERE id = $2`,
      [usuario_id || 1, id]
    );
    
    // 2. Actualizar contrato
    await query(
      `UPDATE contratos
       SET tarjetas_emitidas = tarjetas_emitidas + $1,
           tarjetas_inactivas = tarjetas_inactivas + $1
       WHERE id = $2`,
      [pedido.rows[0].cantidad, pedido.rows[0].contrato_id]
    );
    
    // 3. Descontar stock
    await query(
      `UPDATE productos
       SET stock_actual = stock_actual - $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [pedido.rows[0].cantidad, contrato.rows[0].producto_id]
    );
    
    // 4. Registrar en historial
    await query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, 'pedido', $4)`,
      [contrato.rows[0].producto_id, 0, pedido.rows[0].cantidad, usuario_id || NULL]
    );
    
    res.json({ 
      message: 'Pedido aprobado exitosamente',
      stock_descontado: pedido.rows[0].cantidad
    });
  } catch (error) {
    console.error('Error al aprobar pedido:', error);
    res.status(500).json({ error: 'Error al aprobar pedido' });
  }
};

// Rechazar un pedido
export const rechazarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { razon_rechazo } = req.body;
    
    await query(
      `UPDATE pedidos 
       SET estado = 'rechazado', 
           razon_rechazo = $1
       WHERE id = $2`,
      [razon_rechazo, id]
    );
    
    res.json({ message: 'Pedido rechazado' });
  } catch (error) {
    console.error('Error al rechazar pedido:', error);
    res.status(500).json({ error: 'Error al rechazar pedido' });
  }
};
