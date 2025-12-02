import { query } from '../config/database.js';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Solo se permiten archivos CSV'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Función para validar RFC
function validarRFC(rfc) {
  if (!rfc || rfc.length !== 13) return false;
  const regex = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
  return regex.test(rfc.toUpperCase());
}

// Procesar y validar archivo de nómina
export const validarArchivoNomina = async (req, res) => {
  try {
    const { clienteId, cantidadTarjetasSolicitadas } = req.body;
    const archivo = req.file;

    if (!archivo) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    if (!clienteId || !cantidadTarjetasSolicitadas) {
      return res.status(400).json({ 
        error: 'Faltan parámetros: clienteId y cantidadTarjetasSolicitadas son requeridos' 
      });
    }

    const cantidadSolicitada = parseInt(cantidadTarjetasSolicitadas);

    console.log('📁 Validando archivo:', archivo.originalname);
    console.log('👤 Cliente ID:', clienteId);
    console.log('📊 Tarjetas solicitadas:', cantidadSolicitada);

    // Crear registro de validación
    const validacion = await query(
      `INSERT INTO validaciones_archivo (
        cliente_id, 
        nombre_archivo, 
        tipo_archivo,
        estado
      )
      VALUES ($1, $2, 'csv', 'procesando')
      RETURNING id`,
      [clienteId, archivo.originalname]
    );
    const validacionId = validacion.rows[0].id;

    // Arrays para almacenar resultados
    const empleadosValidos = [];
    const empleadosInvalidos = [];
    const rfcsUnicos = new Set();
    let totalRegistros = 0;

    // Leer y procesar CSV
    const resultados = await new Promise((resolve, reject) => {
      const empleados = [];
      const errores = [];

      fs.createReadStream(archivo.path)
        .pipe(csv())
        .on('data', (row) => {
          totalRegistros++;
          const erroresLinea = [];

          // Limpiar datos
          const id = row.id?.trim();
          const rfc = row.rfc?.trim().toUpperCase();
          const nombre = row.name?.trim();

          // VALIDACIÓN 1: RFC válido
          if (!validarRFC(rfc)) {
            erroresLinea.push('RFC inválido o faltante (debe tener 13 caracteres)');
          }

          // VALIDACIÓN 2: Nombre válido
          if (!nombre || nombre.length < 5) {
            erroresLinea.push('Nombre completo inválido o muy corto');
          }

          // VALIDACIÓN 3: RFC duplicado
          if (rfcsUnicos.has(rfc)) {
            erroresLinea.push('RFC duplicado en el archivo');
          } else if (rfc) {
            rfcsUnicos.add(rfc);
          }

          // Si tiene errores, agregar a inválidos
          if (erroresLinea.length > 0) {
            errores.push({
              linea: totalRegistros + 1, // +1 por el header
              id: id || 'N/A',
              rfc: rfc || 'N/A',
              nombre: nombre || 'N/A',
              errores: erroresLinea
            });
          } else {
            // Si es válido, agregar a válidos
            empleados.push({
              id: id || null,
              rfc,
              nombre_completo: nombre
            });
          }
        })
        .on('end', () => {
          resolve({ empleados, errores });
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    console.log(`✅ Total registros: ${totalRegistros}`);
    console.log(`✅ Válidos: ${resultados.empleados.length}`);
    console.log(`❌ Inválidos: ${resultados.errores.length}`);

    // VALIDACIÓN CRÍTICA: MÍNIMO 90% DE EMPLEADOS
    const minimoEmpleadosRequeridos = Math.ceil(cantidadSolicitada * 0.90);
    const empleadosValidosCount = resultados.empleados.length;

    console.log(`📊 Mínimo requerido (90%): ${minimoEmpleadosRequeridos}`);
    console.log(`📊 Empleados válidos: ${empleadosValidosCount}`);

    if (empleadosValidosCount < minimoEmpleadosRequeridos) {
      // NO CUMPLE CON EL 90%
      await query(
        `UPDATE validaciones_archivo
         SET total_registros = $1,
             registros_validos = $2,
             registros_invalidos = $3,
             errores_detalle = $4,
             estado = 'error'
         WHERE id = $5`,
        [
          totalRegistros,
          empleadosValidosCount,
          resultados.errores.length,
          JSON.stringify(resultados.errores),
          validacionId
        ]
      );

      // Eliminar archivo temporal
      fs.unlinkSync(archivo.path);

      return res.status(400).json({
        success: false,
        error: 'NO_CUMPLE_MINIMO_90',
        mensaje: `❌ El archivo debe contener al menos el 90% de empleados válidos`,
        detalle: {
          tarjetas_solicitadas: cantidadSolicitada,
          minimo_empleados_requerido: minimoEmpleadosRequeridos,
          empleados_validos_encontrados: empleadosValidosCount,
          faltante: minimoEmpleadosRequeridos - empleadosValidosCount,
          porcentaje_cumplido: ((empleadosValidosCount / cantidadSolicitada) * 100).toFixed(2)
        },
        errores_detalle: resultados.errores
      });
    }

    // VERIFICAR DUPLICADOS EN LA BASE DE DATOS
    const duplicados = [];
    for (const emp of resultados.empleados) {
      const existe = await query(
        'SELECT id, nombre_completo FROM empleados_clientes WHERE rfc = $1 AND cliente_id = $2',
        [emp.rfc, clienteId]
      );

      if (existe.rows.length > 0) {
        duplicados.push({
          rfc: emp.rfc,
          nombre: emp.nombre_completo,
          error: 'RFC ya existe en la base de datos'
        });
      } else {
        empleadosValidos.push(emp);
      }
    }

    console.log(`⚠️ Duplicados en BD: ${duplicados.length}`);

    // INSERTAR EMPLEADOS VÁLIDOS EN LA BASE DE DATOS
    for (const emp of empleadosValidos) {
      await query(
        `INSERT INTO empleados_clientes (
          cliente_id, 
          rfc, 
          nombre_completo, 
          status,
          validado_en_archivo
        )
        VALUES ($1, $2, $3, 'activo', $4)
        ON CONFLICT (cliente_id, rfc) DO NOTHING`,
        [clienteId, emp.rfc, emp.nombre_completo, validacionId]
      );
    }

    // ACTUALIZAR REGISTRO DE VALIDACIÓN
    await query(
      `UPDATE validaciones_archivo
       SET total_registros = $1,
           registros_validos = $2,
           registros_invalidos = $3,
           registros_duplicados = $4,
           errores_detalle = $5,
           estado = 'completado'
       WHERE id = $6`,
      [
        totalRegistros,
        empleadosValidos.length,
        resultados.errores.length,
        duplicados.length,
        JSON.stringify([...resultados.errores, ...duplicados]),
        validacionId
      ]
    );

    // Eliminar archivo temporal
    fs.unlinkSync(archivo.path);

    // RESPUESTA EXITOSA
    res.json({
      success: true,
      mensaje: '✅ Archivo validado exitosamente',
      validacion_id: validacionId,
      resumen: {
        total_registros: totalRegistros,
        empleados_validos: empleadosValidos.length,
        empleados_invalidos: resultados.errores.length + duplicados.length,
        tarjetas_solicitadas: cantidadSolicitada,
        minimo_requerido: minimoEmpleadosRequeridos,
        porcentaje_cumplido: ((empleadosValidosCount / cantidadSolicitada) * 100).toFixed(2),
        cumple_requisito_90: true
      },
      errores: [...resultados.errores, ...duplicados]
    });

  } catch (error) {
    console.error('❌ Error al procesar archivo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al procesar archivo',
      detalle: error.message 
    });
  }
};

// Descargar plantilla CSV
export const descargarPlantilla = (req, res) => {
  const plantilla = `id,rfc,name
1,XAXX010101000,Juan Pérez López
2,XEXX010101000,María García González
3,RABC850315AB1,Carlos Ramírez Sánchez`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla_nomina_empleados.csv');
  res.send('\ufeff' + plantilla); // BOM para UTF-8
};

// Obtener empleados validados de un cliente
export const getEmpleadosValidados = async (req, res) => {
  try {
    const { clienteId } = req.params;

    const result = await query(`
      SELECT 
        ec.id,
        ec.rfc,
        ec.nombre_completo,
        ec.status,
        ec.tarjeta_asignada,
        ec.fecha_alta,
        va.nombre_archivo as archivo_validacion
      FROM empleados_clientes ec
      LEFT JOIN validaciones_archivo va ON va.id = ec.validado_en_archivo
      WHERE ec.cliente_id = $1
      ORDER BY ec.fecha_alta DESC
    `, [clienteId]);

    res.json({
      total: result.rows.length,
      empleados: result.rows
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
};
