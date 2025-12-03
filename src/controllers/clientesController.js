import { query } from '../config/database.js';
import bcrypt from 'bcrypt';

// Función para validar RFC Moral (12 caracteres)
function validarRFCMoral(rfc) {
  if (!rfc || rfc.length !== 12) return false;
  // Formato: 3 letras + 6 dígitos (fecha) + 3 caracteres alfanuméricos
  const regex = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/;
  return regex.test(rfc.toUpperCase());
}

// Obtener todos los clientes
export const getAllClientes = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM clientes 
      WHERE status = 'activo'
      ORDER BY nombre
    `);
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
    const { nombre, rfc, contacto_email, contacto_tel, password } = req.body;

    // VALIDACIONES
    const errores = [];

    // 1. Nombre requerido
    if (!nombre || nombre.trim().length < 3) {
      errores.push('Nombre de la empresa es requerido (mínimo 3 caracteres)');
    }

    // 2. RFC Moral requerido y válido
    if (!rfc) {
      errores.push('RFC es requerido');
    } else if (!validarRFCMoral(rfc)) {
      errores.push('RFC inválido. Debe ser RFC Moral de 12 caracteres (Ej: ABC123456XYZ)');
    }

    // 3. Correo electrónico requerido y formato válido
    if (!contacto_email) {
      errores.push('Correo electrónico de la empresa es requerido');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto_email)) {
      errores.push('Formato de correo electrónico inválido');
    }

    // 4. Teléfono requerido (mínimo 10 dígitos)
    if (!contacto_tel) {
      errores.push('Número de teléfono de la empresa es requerido');
    } else if (!/^\d{10,}$/.test(contacto_tel.replace(/\s|-|\(|\)/g, ''))) {
      errores.push('Número de teléfono inválido (debe tener al menos 10 dígitos)');
    }

    // 5. Contraseña requerida (mínimo 6 caracteres)
    if (!password) {
      errores.push('Contraseña es requerida');
    } else if (password.length < 6) {
      errores.push('La contraseña debe tener al menos 6 caracteres');
    }

    // 6. Verificar si el RFC ya existe
    if (rfc) {
      const rfcExiste = await query(
        'SELECT id, nombre FROM clientes WHERE rfc = $1',
        [rfc.toUpperCase()]
      );
      
      if (rfcExiste.rows.length > 0) {
        errores.push(`Este RFC ya está registrado para: ${rfcExiste.rows[0].nombre}`);
      }
    }

    // 7. Verificar si el correo ya existe
    if (contacto_email) {
      const emailExiste = await query(
        'SELECT id, nombre FROM clientes WHERE contacto_email = $1',
        [contacto_email.toLowerCase()]
      );
      
      if (emailExiste.rows.length > 0) {
        errores.push(`Este correo ya está registrado para: ${emailExiste.rows[0].nombre}`);
      }
    }

    // Si hay errores, retornar
    if (errores.length > 0) {
      return res.status(400).json({
        error: 'Errores de validación',
        errores
      });
    }

    // HASHEAR CONTRASEÑA
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // INSERTAR CLIENTE
    const result = await query(
      `INSERT INTO clientes (nombre, rfc, contacto_email, contacto_tel, password, status)
       VALUES ($1, $2, $3, $4, $5, 'activo')
       RETURNING id, nombre, rfc, contacto_email, contacto_tel, status, fecha_alta`,
      [nombre.trim(), rfc.toUpperCase(), contacto_email.toLowerCase(), contacto_tel.trim(), hashedPassword]
    );

    res.status(201).json({
      success: true,
      mensaje: '✅ Cliente registrado exitosamente',
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ 
      error: 'Error al crear cliente',
      detalle: error.message 
    });
  }
};

// Actualizar un cliente
export const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rfc, contacto_email, contacto_tel } = req.body;

    // Verificar que el cliente existe
    const clienteExiste = await query(
      'SELECT id FROM clientes WHERE id = $1',
      [id]
    );

    if (clienteExiste.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Validaciones
    const errores = [];

    // Si se actualiza el RFC, validar
    if (rfc && !validarRFCMoral(rfc)) {
      errores.push('RFC inválido. Debe ser RFC Moral de 12 caracteres');
    }

    // Si se actualiza el email, validar formato
    if (contacto_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto_email)) {
      errores.push('Formato de correo electrónico inválido');
    }

    // Si se actualiza el teléfono, validar formato
    if (contacto_tel && !/^\d{10,}$/.test(contacto_tel.replace(/\s|-|\(|\)/g, ''))) {
      errores.push('Número de teléfono inválido (debe tener al menos 10 dígitos)');
    }

    if (errores.length > 0) {
      return res.status(400).json({
        error: 'Errores de validación',
        errores
      });
    }

    const result = await query(
      `UPDATE clientes
       SET nombre = COALESCE($1, nombre),
           rfc = COALESCE($2, rfc),
           contacto_email = COALESCE($3, contacto_email),
           contacto_tel = COALESCE($4, contacto_tel)
       WHERE id = $5
       RETURNING *`,
      [nombre, rfc?.toUpperCase(), contacto_email?.toLowerCase(), contacto_tel?.trim(), id]
    );

    res.json({
      success: true,
      mensaje: 'Cliente actualizado exitosamente',
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ 
      error: 'Error al actualizar cliente',
      detalle: error.message 
    });
  }
};

// Login de cliente
export const loginCliente = async (req, res) => {
  try {
    const { nombre, password } = req.body;

    // Validaciones
    if (!nombre || !password) {
      return res.status(400).json({ 
        error: 'Nombre de empresa y contraseña son requeridos' 
      });
    }

    // Buscar cliente por nombre
    const result = await query(
      `SELECT id, nombre, rfc, contacto_email, contacto_tel, password, status 
       FROM clientes 
       WHERE nombre = $1`,
      [nombre.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Nombre de empresa o contraseña incorrectos' 
      });
    }

    const cliente = result.rows[0];

    // Verificar si el cliente está activo
    if (cliente.status !== 'activo') {
      return res.status(403).json({ 
        error: 'La cuenta de esta empresa está inactiva. Contacte al administrador.' 
      });
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, cliente.password);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Nombre de empresa o contraseña incorrectos' 
      });
    }

    // Login exitoso - No retornar password
    const { password: _, ...clienteData } = cliente;

    res.json({
      success: true,
      mensaje: `¡Bienvenido ${cliente.nombre}!`,
      cliente: clienteData
    });

  } catch (error) {
    console.error('Error al hacer login:', error);
    res.status(500).json({ 
      error: 'Error al hacer login',
      detalle: error.message 
    });
  }
};
