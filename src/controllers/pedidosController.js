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

// Crear un pedido (CON APROBACIÓN AUTOMÁTICA Y TRANSACCIONES)
export const crearPedido = async (req, res) => {
  const client = await getClient();
  
  try {
    const { contrato_id, cantidad } = req.body;
    
    if (!contrato_id || !cantidad) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    
    // INICIAR TRANSACCIÓN
    await client.query('BEGIN');
    
    // 1. VALIDAR el pedido
    const validacion = await client.query(
      'SELECT * FROM validar_pedido($1, $2)',
      [contrato_id, cantidad]
    );
    
    if (!validacion.rows[0].puede_aprobar) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Pedido no puede ser aprobado',
        razon: validacion.rows[0].razon
      });
    }
    
    // 2. OBTENER información del contrato y producto CON BLOQUEO
    const contratoInfo = await client.query(`
      SELECT 
        c.*,
        p.id as producto_id,
        p.nombre as producto_nombre,
        p.stock_actual,
        ROUND((c.tarjetas_activas::DECIMAL / NULLIF(c.tarjetas_emitidas, 0) * 100), 2) as porcentaje_uso
      FROM contratos c
      JOIN productos p ON p.id = c.producto_id
      WHERE c.id = $1
      FOR UPDATE
    `, [contrato_id]);
    
    if (contratoInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const contrato = contratoInfo.rows[0];
    
    // 3. VALIDAR que hay suficiente stock
    if (contrato.stock_actual < cantidad) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        disponible: contrato.stock_actual,
        solicitado: cantidad,
        faltante: cantidad - contrato.stock_actual
      });
    }
    
    const stockActual = contrato.stock_actual;
    const stockDespues = stockActual - cantidad;
    
    // 4. CREAR pedido CON ESTADO PENDIENTE_ENVIO Y ESTADO_INVENTARIO RESERVADO
    const pedido = await client.query(
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
    await client.query(
      `UPDATE contratos
       SET tarjetas_emitidas = tarjetas_emitidas + $1,
           tarjetas_inactivas = tarjetas_inactivas + $1
       WHERE id = $2`,
      [cantidad, contrato_id]
    );
    
    // 6. ACTUALIZAR ESTADOS DE INVENTARIO
    await client.query(
      `UPDATE estados_inventario
       SET stock_disponible = stock_disponible - $1,
           stock_en_transito = stock_en_transito + $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE producto_id = $2`,
      [cantidad, contrato.producto_id]
    );
    
    // 7. DESCONTAR stock del producto
    await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual - $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [cantidad, contrato.producto_id]
    );
    
    // 8. REGISTRAR en historial de stock
    await client.query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, 'pedido', NULL)`,
      [contrato.producto_id, stockActual, stockDespues]
    );
    
    // CONFIRMAR TRANSACCIÓN
    await client.query('COMMIT');
    
    // 9. RESPONDER con éxito
    res.status(201).json({
      success: true,
      message: '✅ Pedido creado exitosamente. Stock descontado y reservado.',
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
    // REVERTIR TRANSACCIÓN EN CASO DE ERROR
    await client.query('ROLLBACK');
    console.error('❌ Error al crear pedido:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el pedido',
      details: error.message 
    });
  } finally {
    // LIBERAR CONEXIÓN
    client.release();
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

// Crear pedido simple (alternativa para payload con cliente_id y producto_id directos)
export const crearPedidoSimple = async (req, res) => {
  const client = await getClient();
  
  try {
    const { contrato_id, cliente_id, producto_id, cantidad } = req.body;
    
    // Validar parámetros requeridos
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }
    
    // INICIAR TRANSACCIÓN
    await client.query('BEGIN');
    
    let contratoIdFinal = contrato_id;
    
    // Si no viene contrato_id pero sí cliente_id y producto_id, buscar el contrato
    if (!contratoIdFinal && cliente_id && producto_id) {
      const contratoResult = await client.query(
        `SELECT id FROM contratos 
         WHERE cliente_id = $1 AND producto_id = $2 AND status = 'vigente'
         LIMIT 1`,
        [cliente_id, producto_id]
      );
      
      if (contratoResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          error: 'No se encontró un contrato activo para este cliente y producto' 
        });
      }
      
      contratoIdFinal = contratoResult.rows[0].id;
    }
    
    if (!contratoIdFinal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Debe proporcionar contrato_id o la combinación de cliente_id y producto_id' 
      });
    }
    
    // Obtener información del contrato y producto CON BLOQUEO
    const contratoInfo = await client.query(`
      SELECT 
        c.*,
        p.id as producto_id,
        p.nombre as producto_nombre,
        p.stock_actual,
        cl.nombre as cliente_nombre,
        ROUND((c.tarjetas_activas::DECIMAL / NULLIF(c.tarjetas_emitidas, 0) * 100), 2) as porcentaje_uso
      FROM contratos c
      JOIN productos p ON p.id = c.producto_id
      JOIN clientes cl ON cl.id = c.cliente_id
      WHERE c.id = $1
      FOR UPDATE
    `, [contratoIdFinal]);
    
    if (contratoInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    const contrato = contratoInfo.rows[0];
    
    // Validar que el contrato esté activo
    if (contrato.status !== 'vigente') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'El contrato no está activo',
        status_actual: contrato.status
      });
    }
    
    // VALIDAR que hay suficiente stock
    if (contrato.stock_actual < cantidad) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        producto: contrato.producto_nombre,
        disponible: contrato.stock_actual,
        solicitado: cantidad,
        faltante: cantidad - contrato.stock_actual
      });
    }
    
    // Validar límites del contrato
    const tarjetasDisponibles = contrato.tarjetas_maximas - contrato.tarjetas_emitidas;
    if (cantidad > tarjetasDisponibles) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Excede el límite del contrato',
        tarjetas_maximas: contrato.tarjetas_maximas,
        tarjetas_emitidas: contrato.tarjetas_emitidas,
        disponibles: tarjetasDisponibles,
        solicitadas: cantidad
      });
    }
    
    const stockActual = contrato.stock_actual;
    const stockDespues = stockActual - cantidad;
    
    // CREAR pedido
    const pedido = await client.query(
      `INSERT INTO pedidos (
        contrato_id, 
        cantidad, 
        estado,
        estado_inventario,
        fecha_aprobacion,
        porcentaje_uso_momento_pedido,
        tarjetas_inactivas_momento_pedido
      )
      VALUES ($1, $2, 'pendiente_envio', 'reservado', CURRENT_TIMESTAMP, $3, $4)
      RETURNING *`,
      [
        contratoIdFinal, 
        cantidad, 
        contrato.porcentaje_uso || 0,
        contrato.tarjetas_inactivas
      ]
    );
    
    // ACTUALIZAR contrato (incrementar tarjetas)
    await client.query(
      `UPDATE contratos
       SET tarjetas_emitidas = tarjetas_emitidas + $1,
           tarjetas_inactivas = tarjetas_inactivas + $1
       WHERE id = $2`,
      [cantidad, contratoIdFinal]
    );
    
    // DESCONTAR stock del producto
    await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual - $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [cantidad, contrato.producto_id]
    );
    
    // ACTUALIZAR ESTADOS DE INVENTARIO (si existe la tabla)
    const tablaExiste = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'estados_inventario'
      )`
    );
    
    if (tablaExiste.rows[0].exists) {
      await client.query(
        `UPDATE estados_inventario
         SET stock_disponible = stock_disponible - $1,
             stock_en_transito = stock_en_transito + $1,
             ultima_actualizacion = CURRENT_TIMESTAMP
         WHERE producto_id = $2`,
        [cantidad, contrato.producto_id]
      );
    }
    
    // REGISTRAR en historial de stock
    await client.query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, 'pedido', NULL)`,
      [contrato.producto_id, stockActual, stockDespues]
    );
    
    // CONFIRMAR TRANSACCIÓN
    await client.query('COMMIT');
    
    // RESPONDER con éxito
    res.status(201).json({
      success: true,
      mensaje: 'Pedido creado exitosamente',
      pedido_id: pedido.rows[0].id,
      pedido: {
        id: pedido.rows[0].id,
        contrato_id: contratoIdFinal,
        cliente: contrato.cliente_nombre,
        producto: contrato.producto_nombre,
        cantidad: cantidad,
        estado: 'pendiente_envio',
        fecha_solicitud: pedido.rows[0].fecha_solicitud
      },
      inventario: {
        stock_anterior: stockActual,
        stock_actual: stockDespues,
        stock_restante: stockDespues
      },
      contrato: {
        tarjetas_antes: contrato.tarjetas_emitidas,
        tarjetas_despues: contrato.tarjetas_emitidas + cantidad,
        tarjetas_disponibles: tarjetasDisponibles - cantidad
      }
    });
    
  } catch (error) {
    // REVERTIR TRANSACCIÓN EN CASO DE ERROR
    await client.query('ROLLBACK');
    console.error('❌ Error al crear pedido simple:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el pedido',
      detalle: error.message 
    });
  } finally {
    // LIBERAR CONEXIÓN
    client.release();
  }
};
