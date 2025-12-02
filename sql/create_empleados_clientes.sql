-- Tabla para almacenar los empleados de cada cliente
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

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_empleados_cliente ON empleados_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_empleados_rfc ON empleados_clientes(rfc);
CREATE INDEX IF NOT EXISTS idx_empleados_status ON empleados_clientes(status);

-- Comentarios para documentación
COMMENT ON TABLE empleados_clientes IS 'Empleados registrados por cada cliente para la asignación de tarjetas';
COMMENT ON COLUMN empleados_clientes.rfc IS 'RFC del empleado (13 caracteres)';
COMMENT ON COLUMN empleados_clientes.status IS 'Estados posibles: activo, inactivo';
COMMENT ON COLUMN empleados_clientes.validado_en_archivo IS 'ID del archivo de validación donde se registró este empleado';
