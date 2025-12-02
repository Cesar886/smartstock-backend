import { query } from '../config/database.js';

// Obtener todos los repartidores
export const getAllRepartidores = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM repartidores 
      WHERE status = 'disponible'
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener repartidores:', error);
    res.status(500).json({ error: 'Error al obtener repartidores' });
  }
};

// Crear repartidor
export const createRepartidor = async (req, res) => {
  try {
    const { nombre, telefono, vehiculo } = req.body;
    
    const result = await query(
      `INSERT INTO repartidores (nombre, telefono, vehiculo, status)
       VALUES ($1, $2, $3, 'disponible')
       RETURNING *`,
      [nombre, telefono, vehiculo]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear repartidor:', error);
    res.status(500).json({ error: 'Error al crear repartidor' });
  }
};

// Obtener envíos asignados a un repartidor
export const getEnviosRepartidor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        e.*,
        p.cantidad,
        cl.nombre as cliente_nombre,
        cl.direccion as cliente_direccion,
        cl.contacto_tel as cliente_telefono,
        pr.nombre as producto_nombre
      FROM envios e
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN contratos c ON c.id = p.contrato_id
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos pr ON pr.id = c.producto_id
      WHERE e.repartidor_id = $1
      AND e.status IN ('en_transito', 'pendiente')
      ORDER BY e.fecha_salida DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener envíos del repartidor:', error);
    res.status(500).json({ error: 'Error al obtener envíos del repartidor' });
  }
};
