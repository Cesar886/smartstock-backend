-- Agregar campos para tracking de inventario
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_inventario VARCHAR(50) 
DEFAULT 'reservado' CHECK (estado_inventario IN ('reservado', 'despachado', 'en_transito', 'recibido'));

-- Actualizar estados existentes basados en el estado actual
UPDATE pedidos SET estado_inventario = 'reservado' WHERE estado = 'pendiente_envio';
UPDATE pedidos SET estado_inventario = 'despachado' WHERE estado = 'en_transito';
UPDATE pedidos SET estado_inventario = 'recibido' WHERE estado = 'entregado';
