import { query } from '../config/database.js';

// Obtener todas las alertas
export const getAllAlertas = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM alertas
      ORDER BY 
        CASE prioridad
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        fecha_creacion DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
};

// Obtener alertas no resueltas
export const getAlertasNoResueltas = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM alertas
      WHERE resuelta = FALSE
      ORDER BY 
        CASE prioridad
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        fecha_creacion DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener alertas no resueltas:', error);
    res.status(500).json({ error: 'Error al obtener alertas no resueltas' });
  }
};

// Resolver una alerta
export const resolverAlerta = async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(
      `UPDATE alertas 
       SET resuelta = TRUE,
           fecha_resolucion = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    
    res.json({ message: 'Alerta resuelta exitosamente' });
  } catch (error) {
    console.error('Error al resolver alerta:', error);
    res.status(500).json({ error: 'Error al resolver alerta' });
  }
};

// Generar alertas automáticas
export const generarAlertasAutomaticas = async (req, res) => {
  try {
    // Alertas de stock muerto
    await query(`
      INSERT INTO alertas (tipo, entidad_id, mensaje, prioridad)
      SELECT 
        'stock_muerto',
        contrato_id,
        'Cliente ' || cliente || ' tiene ' || tarjetas_inactivas || ' tarjetas sin usar (' || ROUND(100 - porcentaje_uso, 0) || '% del total)',
        CASE 
          WHEN porcentaje_uso < 30 THEN 'critica'
          WHEN porcentaje_uso < 50 THEN 'alta'
          ELSE 'media'
        END
      FROM v_salud_contratos
      WHERE porcentaje_uso < 70
      AND NOT EXISTS (
        SELECT 1 FROM alertas a 
        WHERE a.tipo = 'stock_muerto' 
        AND a.entidad_id = v_salud_contratos.contrato_id
        AND a.resuelta = FALSE
      )
    `);
    
    // Alertas de stock bajo
    await query(`
      INSERT INTO alertas (tipo, entidad_id, mensaje, prioridad)
      SELECT 
        'stock_bajo',
        producto_id,
        'Producto ' || nombre || ' tiene solo ' || stock_actual || ' unidades (minimo: ' || stock_minimo || ')',
        CASE 
          WHEN estado_stock = 'CRITICO' THEN 'critica'
          ELSE 'alta'
        END
      FROM v_alertas_stock
      WHERE estado_stock IN ('BAJO', 'CRITICO')
      AND NOT EXISTS (
        SELECT 1 FROM alertas a 
        WHERE a.tipo = 'stock_bajo' 
        AND a.entidad_id = v_alertas_stock.producto_id
        AND a.resuelta = FALSE
      )
    `);
    
    res.json({ message: 'Alertas generadas exitosamente' });
  } catch (error) {
    console.error('Error al generar alertas:', error);
    res.status(500).json({ error: 'Error al generar alertas' });
  }
};
