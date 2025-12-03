-- Agregar campo de contraseña a la tabla clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Comentario para documentación
COMMENT ON COLUMN clientes.password IS 'Contraseña hasheada con bcrypt para autenticación del cliente';
