# Sistema de Autenticación de Clientes

## Descripción
Sistema de autenticación para clientes empresariales usando el nombre de la empresa como usuario y una contraseña segura.

## Características
- **Usuario**: Nombre de la empresa
- **Contraseña**: Hash seguro con bcrypt (10 rounds)
- Validaciones de seguridad en registro y login
- Verificación de estado de cuenta activa

---

## Configuración Inicial

### 1. Ejecutar Migración SQL
Ejecuta el siguiente script para agregar el campo de contraseña a la tabla clientes:

```bash
psql -U tu_usuario -d tu_base_de_datos -f sql/add_password_clientes.sql
```

---

## API Endpoints

### 1. Registro de Cliente
**POST** `/api/clientes`

Crea un nuevo cliente con autenticación.

#### Request Body:
```json
{
  "nombre": "Empresa XYZ S.A. de C.V.",
  "rfc": "EXY123456ABC",
  "contacto_email": "contacto@empresaxyz.com",
  "contacto_tel": "5512345678",
  "password": "mi_contraseña_segura"
}
```

#### Validaciones:
- **nombre**: Mínimo 3 caracteres (requerido)
- **rfc**: RFC Moral de 12 caracteres (requerido, único)
- **contacto_email**: Email válido (requerido, único)
- **contacto_tel**: Mínimo 10 dígitos (requerido)
- **password**: Mínimo 6 caracteres (requerido)

#### Response Exitoso (201):
```json
{
  "success": true,
  "mensaje": "✅ Cliente registrado exitosamente",
  "cliente": {
    "id": 1,
    "nombre": "Empresa XYZ S.A. de C.V.",
    "rfc": "EXY123456ABC",
    "contacto_email": "contacto@empresaxyz.com",
    "contacto_tel": "5512345678",
    "status": "activo",
    "fecha_alta": "2025-12-02T10:30:00.000Z"
  }
}
```

**Nota**: La contraseña NO se retorna en la respuesta por seguridad.

#### Response Error (400):
```json
{
  "error": "Errores de validación",
  "errores": [
    "La contraseña debe tener al menos 6 caracteres",
    "Este RFC ya está registrado para: Otra Empresa"
  ]
}
```

---

### 2. Login de Cliente
**POST** `/api/clientes/login`

Autentica un cliente usando el nombre de la empresa y contraseña.

#### Request Body:
```json
{
  "nombre": "Empresa XYZ S.A. de C.V.",
  "password": "mi_contraseña_segura"
}
```

#### Response Exitoso (200):
```json
{
  "success": true,
  "mensaje": "¡Bienvenido Empresa XYZ S.A. de C.V.!",
  "cliente": {
    "id": 1,
    "nombre": "Empresa XYZ S.A. de C.V.",
    "rfc": "EXY123456ABC",
    "contacto_email": "contacto@empresaxyz.com",
    "contacto_tel": "5512345678",
    "status": "activo"
  }
}
```

#### Response Error (401 - Credenciales incorrectas):
```json
{
  "error": "Nombre de empresa o contraseña incorrectos"
}
```

#### Response Error (403 - Cuenta inactiva):
```json
{
  "error": "La cuenta de esta empresa está inactiva. Contacte al administrador."
}
```

#### Response Error (400 - Campos faltantes):
```json
{
  "error": "Nombre de empresa y contraseña son requeridos"
}
```

---

## Ejemplos de Uso

### Registro con curl:
```bash
curl -X POST http://localhost:3000/api/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Empresa XYZ S.A. de C.V.",
    "rfc": "EXY123456ABC",
    "contacto_email": "contacto@empresaxyz.com",
    "contacto_tel": "5512345678",
    "password": "mi_contraseña_segura"
  }'
```

### Login con curl:
```bash
curl -X POST http://localhost:3000/api/clientes/login \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Empresa XYZ S.A. de C.V.",
    "password": "mi_contraseña_segura"
  }'
```

### JavaScript (Frontend):
```javascript
// Registro
async function registrarEmpresa() {
  try {
    const response = await fetch('http://localhost:3000/api/clientes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: 'Empresa XYZ S.A. de C.V.',
        rfc: 'EXY123456ABC',
        contacto_email: 'contacto@empresaxyz.com',
        contacto_tel: '5512345678',
        password: 'mi_contraseña_segura'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Registro exitoso:', data.cliente);
      // Guardar datos del cliente en localStorage o estado
      localStorage.setItem('cliente', JSON.stringify(data.cliente));
    } else {
      console.error('Errores:', data.errores);
    }
  } catch (error) {
    console.error('Error de red:', error);
  }
}

// Login
async function loginEmpresa(nombreEmpresa, password) {
  try {
    const response = await fetch('http://localhost:3000/api/clientes/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: nombreEmpresa,
        password: password
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Login exitoso:', data.mensaje);
      // Guardar sesión del cliente
      localStorage.setItem('cliente', JSON.stringify(data.cliente));
      localStorage.setItem('isLoggedIn', 'true');
      return data.cliente;
    } else {
      alert(data.error);
      return null;
    }
  } catch (error) {
    console.error('Error de red:', error);
    alert('Error al intentar hacer login');
    return null;
  }
}
```

---

## Seguridad

### Contraseñas
- Las contraseñas se almacenan usando **bcrypt** con 10 rounds de salt
- NUNCA se retornan las contraseñas en las respuestas de la API
- Mínimo 6 caracteres requeridos (se recomienda usar contraseñas más largas)

### Validaciones
- El nombre de la empresa debe ser único
- RFC debe ser único
- Email debe ser único
- Se verifica el estado de la cuenta antes de permitir login

### Recomendaciones
1. Implementar rate limiting para prevenir ataques de fuerza bruta
2. Agregar tokens JWT para mantener sesiones
3. Implementar recuperación de contraseña
4. Agregar autenticación de dos factores (2FA)
5. Usar HTTPS en producción

---

## Notas
- El campo `password` en la tabla `clientes` almacena el hash de la contraseña, no la contraseña en texto plano
- Los clientes con status 'inactivo' no pueden hacer login
- Se recomienda cambiar la contraseña regularmente
