-- Script para crear repartidores y paqueterías
-- Sistema de Tracking y Gestión de Entregas

-- Limpiar repartidores anteriores (opcional)
-- DELETE FROM repartidores WHERE id > 0;

-- Insertar repartidor local
INSERT INTO repartidores (nombre, telefono, vehiculo, status) VALUES
('Repartidor Local', '555-1000', 'Moto/Auto', 'disponible')
ON CONFLICT DO NOTHING;

-- Insertar paqueterías nacionales e internacionales
INSERT INTO repartidores (nombre, telefono, vehiculo, status) VALUES
('DHL Express', '800-765-6345', 'Paquetería', 'disponible'),
('Estafeta', '800-378-2338', 'Paquetería', 'disponible'),
('UPS', '800-742-5877', 'Paquetería', 'disponible'),
('FedEx', '800-900-1100', 'Paquetería', 'disponible'),
('Redpack', '800-733-7225', 'Paquetería', 'disponible'),
('Paquetexpress', '800-501-0011', 'Paquetería', 'disponible'),
('99 Minutos', '800-999-6468', 'Paquetería', 'disponible'),
('Sendex', '800-736-3391', 'Paquetería', 'disponible')
ON CONFLICT DO NOTHING;

-- Verificar que se crearon correctamente
SELECT * FROM repartidores ORDER BY id;
