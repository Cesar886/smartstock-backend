import { query } from '../config/database.js';

// Obtener todos los contratos
export const getAllContratos = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        p.nombre as producto_nombre
      FROM contratos c
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos p ON p.id = c.producto_id
      ORDER BY c.id
    `);
    
    const contratos = result.rows.map(contrato => ({
      ...contrato,
      tarjetas_emitidas: parseInt(contrato.tarjetas_emitidas, 10),
      tarjetas_activas: parseInt(contrato.tarjetas_activas, 10),
      tarjetas_inactivas: parseInt(contrato.tarjetas_inactivas, 10)
    }));
    
    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

// Obtener un contrato por ID
export const getContratoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        p.nombre as producto_nombre
      FROM contratos c
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN productos p ON p.id = c.producto_id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
};

// Obtener salud de contratos (vista)
export const getSaludContratos = async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_salud_contratos ORDER BY porcentaje_uso ASC');
    
    const contratos = result.rows.map(contrato => ({
      ...contrato,
      tarjetas_emitidas: parseInt(contrato.tarjetas_emitidas, 10),
      tarjetas_activas: parseInt(contrato.tarjetas_activas, 10),
      tarjetas_inactivas: parseInt(contrato.tarjetas_inactivas, 10),
      tarjetas_permitidas: parseInt(contrato.tarjetas_permitidas, 10)
    }));
    
    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener salud de contratos:', error);
    res.status(500).json({ error: 'Error al obtener salud de contratos' });
  }
};

// Obtener contratos por cliente
export const getContratosByCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const result = await query(`
      SELECT * FROM v_salud_contratos 
      WHERE cliente_id = $1
      ORDER BY porcentaje_uso ASC
    `, [clienteId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener contratos del cliente:', error);
    res.status(500).json({ error: 'Error al obtener contratos del cliente' });
  }
};

// Obtener productos disponibles por cliente (basado en contratos activos)
export const getProductosDisponiblesPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const result = await query(`
      SELECT DISTINCT
        p.id,
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        c.tarjetas_activas as tarjetas_cliente
      FROM contratos c
      JOIN productos p ON p.id = c.producto_id
      WHERE c.cliente_id = $1
        AND c.estado = 'activo'
      ORDER BY p.nombre
    `, [clienteId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos disponibles:', error);
    res.status(500).json({ error: 'Error al obtener productos disponibles' });
  }
};

// Obtener resumen estadístico
export const getResumenEstadistico = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_contratos,
        SUM(tarjetas_emitidas) as total_emitidas,
        SUM(tarjetas_activas) as total_activas,
        SUM(tarjetas_inactivas) as total_inactivas,
        ROUND(AVG(porcentaje_uso), 1) as uso_promedio,
        COUNT(CASE WHEN nivel_salud = 'Critico' THEN 1 END) as contratos_criticos,
        COUNT(CASE WHEN nivel_salud = 'En Riesgo' THEN 1 END) as contratos_riesgo,
        COUNT(CASE WHEN nivel_salud = 'Aceptable' THEN 1 END) as contratos_aceptable,
        COUNT(CASE WHEN nivel_salud = 'Optimo' THEN 1 END) as contratos_optimo
      FROM v_salud_contratos
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener resumen estadístico:', error);
    res.status(500).json({ error: 'Error al obtener resumen estadístico' });
  }
};
