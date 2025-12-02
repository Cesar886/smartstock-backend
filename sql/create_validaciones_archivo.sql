-- Tabla para registrar las validaciones de archivos de nómina
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

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_validaciones_cliente ON validaciones_archivo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_validaciones_estado ON validaciones_archivo(estado);
CREATE INDEX IF NOT EXISTS idx_validaciones_fecha ON validaciones_archivo(fecha_creacion);

-- Comentarios para documentación
COMMENT ON TABLE validaciones_archivo IS 'Registro de validaciones de archivos de nómina cargados por clientes';
COMMENT ON COLUMN validaciones_archivo.estado IS 'Estados posibles: procesando, completado, error';
COMMENT ON COLUMN validaciones_archivo.errores_detalle IS 'Detalles de los errores encontrados en formato JSON';
