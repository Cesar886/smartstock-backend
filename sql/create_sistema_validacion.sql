-- Script maestro para crear las tablas necesarias del sistema de validación de empleados
-- Ejecutar en orden

-- 1. Crear tabla de validaciones de archivos
CREATE TABLE IF NOT EXISTS validaciones_archivo (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_archivo VARCHAR(50) NOT NULL DEFAULT 'csv',
  estado VARCHAR(50) NOT NULL DEFAULT 'procesando', -- procesando, completado, error
  total_registros INTEGER DEFAULT 0,
  registros_validos INTEGER DEFAULT 0,
  registros_invalidos INTEGER DEFAULT 0,
  registros_duplicados INTEGER DEFAULT 0,
  errores_detalle JSONB,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para validaciones_archivo
CREATE INDEX IF NOT EXISTS idx_validaciones_cliente ON validaciones_archivo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_validaciones_estado ON validaciones_archivo(estado);
CREATE INDEX IF NOT EXISTS idx_validaciones_fecha ON validaciones_archivo(fecha_creacion);

-- Comentarios para validaciones_archivo
COMMENT ON TABLE validaciones_archivo IS 'Registro de validaciones de archivos de nómina cargados por clientes';
COMMENT ON COLUMN validaciones_archivo.estado IS 'Estados posibles: procesando, completado, error';
COMMENT ON COLUMN validaciones_archivo.errores_detalle IS 'Detalles de los errores encontrados en formato JSON';

-- 2. Crear tabla de empleados de clientes
CREATE TABLE IF NOT EXISTS empleados_clientes (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  rfc VARCHAR(13) NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'activo', -- activo, inactivo
  validado_en_archivo INTEGER REFERENCES validaciones_archivo(id),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint para evitar duplicados de RFC por cliente
  CONSTRAINT unique_rfc_por_cliente UNIQUE (cliente_id, rfc)
);

-- Índices para empleados_clientes
CREATE INDEX IF NOT EXISTS idx_empleados_cliente ON empleados_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_empleados_rfc ON empleados_clientes(rfc);
CREATE INDEX IF NOT EXISTS idx_empleados_status ON empleados_clientes(status);

-- Comentarios para empleados_clientes
COMMENT ON TABLE empleados_clientes IS 'Empleados registrados por cada cliente para la asignación de tarjetas';
COMMENT ON COLUMN empleados_clientes.rfc IS 'RFC del empleado (13 caracteres)';
COMMENT ON COLUMN empleados_clientes.status IS 'Estados posibles: activo, inactivo';
COMMENT ON COLUMN empleados_clientes.validado_en_archivo IS 'ID del archivo de validación donde se registró este empleado';

-- Mensaje de éxito
DO $$
BEGIN
  RAISE NOTICE '✅ Tablas de validación de empleados creadas exitosamente';
END $$;
