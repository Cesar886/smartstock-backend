import { query } from '../config/database.js';

// Crear un envío (cuando sale del almacén)
export const crearEnvio = async (req, res) => {
  try {
    const { pedido_id, repartidor_id } = req.body;
    
    // Verificar que el pedido exista y esté pendiente
    const pedido = await query(
      'SELECT * FROM pedidos WHERE id = $1 AND estado = $2',
      [pedido_id, 'pendiente_envio']
    );
    
    if (pedido.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado o no está pendiente de envío' 
      });
    }
    
    // Generar tracking code único
    const tracking_code = `TRACK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Crear el envío
    const envio = await query(
      `INSERT INTO envios (
        pedido_id, 
        repartidor_id, 
        tracking_code, 
        fecha_salida,
        status
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'en_transito')
      RETURNING *`,
      [pedido_id, repartidor_id, tracking_code]
    );
    
    // Actualizar estado del pedido
    await query(
      `UPDATE pedidos 
       SET estado = 'en_transito' 
       WHERE id = $1`,
      [pedido_id]
    );
    
    // Obtener datos completos del envío
    const envioCompleto = await query(`
      SELECT 
        e.*,
        r.nombre as repartidor_nombre,
        r.telefono as repartidor_telefono,
        r.vehiculo as repartidor_vehiculo,
        p.cantidad,
        cl.nombre as cliente_nombre,
        pr.nombre as producto_nombre
      FROM envios e
      JOIN repartidores r ON r.id = e.repartidor_id
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos pr ON pr.id = c.producto_id
      WHERE e.id = $1
    `, [envio.rows[0].id]);
    
    res.status(201).json({
      success: true,
      message: 'Envío creado exitosamente',
      envio: envioCompleto.rows[0]
    });
    
  } catch (error) {
    console.error('Error al crear envío:', error);
    res.status(500).json({ error: 'Error al crear envío' });
  }
};

// Actualizar ubicación del repartidor (GPS tracking)
export const actualizarUbicacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitud, longitud } = req.body;
    
    await query(
      `UPDATE envios 
       SET ubicacion_actual_lat = $1,
           ubicacion_actual_lng = $2
       WHERE id = $3 AND status = 'en_transito'`,
      [latitud, longitud, id]
    );
    
    res.json({
      success: true,
      message: 'Ubicación actualizada',
      ubicacion: { latitud, longitud }
    });
    
  } catch (error) {
    console.error('Error al actualizar ubicación:', error);
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
};

// Marcar como entregado
export const marcarEntregado = async (req, res) => {
  try {
    const { id } = req.params;
    const { evidencia_foto_url } = req.body;
    
    // Obtener datos del envío
    const envioData = await query(`
      SELECT e.*, p.contrato_id, p.cantidad, c.producto_id
      FROM envios e
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      WHERE e.id = $1
    `, [id]);
    
    if (envioData.rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }
    
    const envio = envioData.rows[0];
    
    // Actualizar envío como entregado
    await query(
      `UPDATE envios 
       SET status = 'entregado',
           fecha_entrega = CURRENT_TIMESTAMP,
           evidencia_foto_url = $1
       WHERE id = $2`,
      [evidencia_foto_url, id]
    );
    
    // Actualizar pedido como entregado y estado_inventario a recibido
    await query(
      `UPDATE pedidos 
       SET estado = 'entregado',
           estado_inventario = 'recibido'
       WHERE id = $1`,
      [envio.pedido_id]
    );
    
    // Actualizar estados de inventario
    await query(
      `UPDATE estados_inventario
       SET stock_en_transito = stock_en_transito - $1,
           stock_recibido_cliente = stock_recibido_cliente + $1,
           ultima_actualizacion = CURRENT_TIMESTAMP
       WHERE producto_id = $2`,
      [envio.cantidad, envio.producto_id]
    );
    
    // Registrar en historial
    await query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, 'entrega_confirmada', 0)`,
      [envio.producto_id, 0, envio.cantidad]
    );
    
    res.json({
      success: true,
      message: '✅ Entrega confirmada. Inventario actualizado.',
      envio_id: id
    });
    
  } catch (error) {
    console.error('Error al marcar entregado:', error);
    res.status(500).json({ error: 'Error al marcar como entregado' });
  }
};

// Obtener tracking de un envío
export const getTracking = async (req, res) => {
  try {
    const { tracking_code } = req.params;
    
    const result = await query(`
      SELECT 
        e.*,
        r.nombre as repartidor_nombre,
        r.telefono as repartidor_telefono,
        r.vehiculo as repartidor_vehiculo,
        p.cantidad,
        p.estado as pedido_estado,
        cl.nombre as cliente_nombre,
        cl.direccion as cliente_direccion,
        pr.nombre as producto_nombre
      FROM envios e
      JOIN repartidores r ON r.id = e.repartidor_id
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos pr ON pr.id = c.producto_id
      WHERE e.tracking_code = $1
    `, [tracking_code]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tracking code no encontrado' 
      });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error al obtener tracking:', error);
    res.status(500).json({ error: 'Error al obtener tracking' });
  }
};

// Obtener todos los envíos activos
export const getEnviosActivos = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        e.*,
        r.nombre as repartidor_nombre,
        p.cantidad,
        cl.nombre as cliente_nombre,
        pr.nombre as producto_nombre
      FROM envios e
      JOIN repartidores r ON r.id = e.repartidor_id
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos pr ON pr.id = c.producto_id
      WHERE e.status IN ('en_transito', 'pendiente')
      ORDER BY e.fecha_salida DESC
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error al obtener envíos activos:', error);
    res.status(500).json({ error: 'Error al obtener envíos activos' });
  }
};

// Obtener historial de envíos de un cliente
export const getEnviosPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const result = await query(`
      SELECT 
        e.*,
        r.nombre as repartidor_nombre,
        p.cantidad,
        p.estado as pedido_estado,
        pr.nombre as producto_nombre
      FROM envios e
      JOIN repartidores r ON r.id = e.repartidor_id
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      JOIN productos pr ON pr.id = c.producto_id
      WHERE c.cliente_id = $1
      ORDER BY e.fecha_salida DESC
    `, [clienteId]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error al obtener envíos del cliente:', error);
    res.status(500).json({ error: 'Error al obtener envíos del cliente' });
  }
};
