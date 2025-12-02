import { query } from '../config/database.js';

// Crear un ticket
export const crearTicket = async (req, res) => {
  try {
    const { cliente_id, tipo, asunto, mensaje, creado_por } = req.body;
    
    const result = await query(
      `INSERT INTO tickets (cliente_id, tipo, asunto, mensaje, creado_por, estado)
       VALUES ($1, $2, $3, $4, $5, 'abierto')
       RETURNING *`,
      [cliente_id, tipo, asunto, mensaje, creado_por]
    );
    
    res.status(201).json({
      success: true,
      message: 'Ticket creado exitosamente',
      ticket: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear ticket:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

// Obtener tickets de un cliente
export const getTicketsPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const result = await query(`
      SELECT 
        t.*,
        cl.nombre as cliente_nombre,
        u.email as creado_por_email,
        COUNT(rt.id) as num_respuestas
      FROM tickets t
      JOIN clientes cl ON cl.id = t.cliente_id
      LEFT JOIN usuarios u ON u.id = t.creado_por
      LEFT JOIN respuestas_tickets rt ON rt.ticket_id = t.id
      WHERE t.cliente_id = $1
      GROUP BY t.id, cl.nombre, u.email
      ORDER BY t.fecha_creacion DESC
    `, [clienteId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

// Agregar respuesta a un ticket
export const agregarRespuesta = async (req, res) => {
  try {
    const { ticket_id, usuario_id, mensaje, es_interno } = req.body;
    
    const result = await query(
      `INSERT INTO respuestas_tickets (ticket_id, usuario_id, mensaje, es_interno)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticket_id, usuario_id, mensaje, es_interno || false]
    );
    
    // Actualizar fecha de última actualización del ticket
    await query(
      `UPDATE tickets 
       SET fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ticket_id]
    );
    
    res.status(201).json({
      success: true,
      respuesta: result.rows[0]
    });
  } catch (error) {
    console.error('Error al agregar respuesta:', error);
    res.status(500).json({ error: 'Error al agregar respuesta' });
  }
};

// Obtener detalles de un ticket con respuestas
export const getTicketDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await query(`
      SELECT t.*, cl.nombre as cliente_nombre
      FROM tickets t
      JOIN clientes cl ON cl.id = t.cliente_id
      WHERE t.id = $1
    `, [id]);
    
    if (ticket.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    
    const respuestas = await query(`
      SELECT r.*, u.email as usuario_email
      FROM respuestas_tickets r
      LEFT JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.ticket_id = $1
      ORDER BY r.fecha_creacion ASC
    `, [id]);
    
    res.json({
      ticket: ticket.rows[0],
      respuestas: respuestas.rows
    });
  } catch (error) {
    console.error('Error al obtener detalle de ticket:', error);
    res.status(500).json({ error: 'Error al obtener detalle' });
  }
};

// Cerrar un ticket
export const cerrarTicket = async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(
      `UPDATE tickets 
       SET estado = 'cerrado',
           fecha_resolucion = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Ticket cerrado'
    });
  } catch (error) {
    console.error('Error al cerrar ticket:', error);
    res.status(500).json({ error: 'Error al cerrar ticket' });
  }
};
