import { query } from '../config/database.js';

// Obtener todos los productos
export const getAllProductos = async (req, res) => {
  try {
    const result = await query('SELECT * FROM productos ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// Obtener un producto por ID
export const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM productos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// Obtener alertas de stock
export const getAlertasStock = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM v_alertas_stock
      WHERE estado_stock IN ('CRITICO', 'BAJO')
      ORDER BY 
        CASE estado_stock
          WHEN 'CRITICO' THEN 1
          WHEN 'BAJO' THEN 2
        END
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener alertas de stock:', error);
    res.status(500).json({ error: 'Error al obtener alertas de stock' });
  }
};

// Actualizar stock de un producto
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, razon, usuario_id } = req.body;
    
    // Obtener stock actual
    const productoActual = await query('SELECT stock_actual FROM productos WHERE id = $1', [id]);
    
    if (productoActual.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const stockAnterior = productoActual.rows[0].stock_actual;
    const nuevoStock = stockAnterior + cantidad;
    
    // Actualizar stock
    await query(
      'UPDATE productos SET stock_actual = $1, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = $2',
      [nuevoStock, id]
    );
    
    // Registrar en historial
    await query(
      `INSERT INTO historial_stock (producto_id, cantidad_anterior, cantidad_nueva, razon, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, stockAnterior, nuevoStock, razon, usuario_id]
    );
    
    res.json({ 
      message: 'Stock actualizado correctamente',
      stock_anterior: stockAnterior,
      stock_nuevo: nuevoStock
    });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
};
