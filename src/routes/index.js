import express from 'express';
import * as clientesController from '../controllers/clientesController.js';
import * as productosController from '../controllers/productosController.js';
import * as contratosController from '../controllers/contratosController.js';
import * as pedidosController from '../controllers/pedidosController.js';
import * as alertasController from '../controllers/alertasController.js';
import * as enviosController from '../controllers/enviosController.js';
import * as repartidoresController from '../controllers/repartidoresController.js';
import * as ticketsController from '../controllers/ticketsController.js';
import * as inventarioController from '../controllers/inventarioController.js';

const router = express.Router();

// ============================================
// RUTAS DE CLIENTES
// ============================================
router.get('/clientes', clientesController.getAllClientes);
router.get('/clientes/:id', clientesController.getClienteById);
router.post('/clientes', clientesController.createCliente);
router.put('/clientes/:id', clientesController.updateCliente);

// ============================================
// RUTAS DE PRODUCTOS
// ============================================
router.get('/productos', productosController.getAllProductos);
router.get('/productos/:id', productosController.getProductoById);
router.get('/productos/alertas/stock', productosController.getAlertasStock);
router.put('/productos/:id/stock', productosController.updateStock);

// ============================================
// RUTAS DE CONTRATOS
// ============================================
router.get('/contratos', contratosController.getAllContratos);
router.get('/contratos/salud', contratosController.getSaludContratos);
router.get('/contratos/resumen/estadistico', contratosController.getResumenEstadistico);
router.get('/contratos/cliente/:clienteId/productos', contratosController.getProductosDisponiblesPorCliente);
router.get('/contratos/cliente/:clienteId', contratosController.getContratosByCliente);
router.get('/contratos/:id', contratosController.getContratoById);

// ============================================
// RUTAS DE PEDIDOS
// ============================================
router.post('/pedidos/validar', pedidosController.validarPedido);
router.post('/pedidos', pedidosController.crearPedido);
router.get('/pedidos', pedidosController.getAllPedidos);
router.put('/pedidos/:id/aprobar', pedidosController.aprobarPedido);
router.put('/pedidos/:id/rechazar', pedidosController.rechazarPedido);

// ============================================
// RUTAS DE ALERTAS
// ============================================
router.get('/alertas', alertasController.getAllAlertas);
router.get('/alertas/no-resueltas', alertasController.getAlertasNoResueltas);
router.put('/alertas/:id/resolver', alertasController.resolverAlerta);
router.post('/alertas/generar', alertasController.generarAlertasAutomaticas);

// ============================================
// RUTAS DE ENVÍOS
// ============================================
router.post('/envios', enviosController.crearEnvio);
router.get('/envios/activos', enviosController.getEnviosActivos);
router.get('/envios/tracking/:tracking_code', enviosController.getTracking);
router.get('/envios/cliente/:clienteId', enviosController.getEnviosPorCliente);
router.put('/envios/:id/ubicacion', enviosController.actualizarUbicacion);
router.put('/envios/:id/entregar', enviosController.marcarEntregado);

// ============================================
// RUTAS DE REPARTIDORES
// ============================================
router.get('/repartidores', repartidoresController.getAllRepartidores);
router.post('/repartidores', repartidoresController.createRepartidor);
router.get('/repartidores/:id/envios', repartidoresController.getEnviosRepartidor);

// ============================================
// RUTAS DE TICKETS (COMUNICACIÓN)
// ============================================
router.post('/tickets', ticketsController.crearTicket);
router.get('/tickets/cliente/:clienteId', ticketsController.getTicketsPorCliente);
router.get('/tickets/:id', ticketsController.getTicketDetalle);
router.post('/tickets/respuesta', ticketsController.agregarRespuesta);
router.put('/tickets/:id/cerrar', ticketsController.cerrarTicket);

// ============================================
// RUTAS DE INVENTARIO
// ============================================
router.get('/inventario/estados', inventarioController.getEstadosInventario);
router.get('/inventario/producto/:productoId', inventarioController.getEstadoProducto);
router.get('/inventario/resumen', inventarioController.getResumenInventario);
router.get('/inventario/movimientos', inventarioController.getMovimientos);

// ============================================
// RUTAS DE VALIDACIÓN DE NÓMINA
// ============================================
import { upload as uploadNomina } from '../controllers/validacionEmpleadosController.js';
import * as validacionController from '../controllers/validacionEmpleadosController.js';

router.post('/validacion/nomina', uploadNomina.single('archivo'), validacionController.validarArchivoNomina);
router.get('/validacion/plantilla', validacionController.descargarPlantilla);
router.get('/validacion/empleados/:clienteId', validacionController.getEmpleadosValidados);

export default router;
