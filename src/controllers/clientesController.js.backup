import { query } from '../config/database.js';

// Obtener todos los clientes
export const getAllClientes = async (req, res) => {
  try {
    const result = await query('SELECT * FROM clientes ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

// Obtener un cliente por ID
export const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM clientes WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
};

// Crear un nuevo cliente
export const createCliente = async (req, res) => {
  try {
    const { nombre, rfc, contacto_nombre, contacto_email, contacto_tel, direccion } = req.body;
    
    const result = await query(
      `INSERT INTO clientes (nombre, rfc, contacto_nombre, contacto_email, contacto_tel, direccion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, rfc, contacto_nombre, contacto_email, contacto_tel, direccion]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
};

// Actualizar un cliente
export const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rfc, contacto_nombre, contacto_email, contacto_tel, direccion, status } = req.body;
    
    const result = await query(
      `UPDATE clientes 
       SET nombre = $1, rfc = $2, contacto_nombre = $3, contacto_email = $4, 
           contacto_tel = $5, direccion = $6, status = $7
       WHERE id = $8
       RETURNING *`,
      [nombre, rfc, contacto_nombre, contacto_email, contacto_tel, direccion, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
};
