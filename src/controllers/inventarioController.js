import { query } from '../config/database.js';

// Obtener estados de inventario
export const getEstadosInventario = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ei.*,
        p.nombre as producto_nombre,
        p.stock_minimo
      FROM estados_inventario ei
      JOIN productos p ON p.id = ei.producto_id
      ORDER BY p.nombre
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener estados de inventario:', error);
    res.status(500).json({ error: 'Error al obtener estados de inventario' });
  }
};

// Obtener estado de un producto específico
export const getEstadoProducto = async (req, res) => {
  try {
    const { productoId } = req.params;
    
    const result = await query(`
      SELECT 
        ei.*,
        p.nombre as producto_nombre,
        p.stock_minimo,
        p.stock_maximo
      FROM estados_inventario ei
      JOIN productos p ON p.id = ei.producto_id
      WHERE ei.producto_id = $1
    `, [productoId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener estado del producto:', error);
    res.status(500).json({ error: 'Error al obtener estado del producto' });
  }
};

// Obtener resumen general del inventario
export const getResumenInventario = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        SUM(stock_disponible) as total_disponible,
        SUM(stock_en_transito) as total_en_transito,
        SUM(stock_recibido_cliente) as total_recibido,
        SUM(stock_total) as total_general,
        COUNT(*) as total_productos
      FROM estados_inventario
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener resumen de inventario:', error);
    res.status(500).json({ error: 'Error al obtener resumen de inventario' });
  }
};

// Obtener movimientos de inventario (historial)
export const getMovimientos = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        h.*,
        p.nombre as producto_nombre
      FROM historial_stock h
      JOIN productos p ON p.id = h.producto_id
      ORDER BY h.fecha DESC
      LIMIT 50
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};
