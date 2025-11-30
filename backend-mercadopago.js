// ================================================
// BACKEND MEJORADO - Con Mejor Manejo de Errores
// ================================================

require('dotenv').config();
const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors({
    origin: ['https://playful-daifuku-1be911.netlify.app/', 'http://localhost:8000'],
    credentials: true
}));
app.use(express.json());

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 INICIANDO SERVIDOR');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ================================================
// VERIFICAR CONFIGURACIÓN
// ================================================

if (!process.env.ACCESS_TOKEN) {
    console.error('❌ ERROR: No se encontró ACCESS_TOKEN en el archivo .env');
    console.log('');
    console.log('Solución:');
    console.log('1. Verifica que existe el archivo .env en esta carpeta');
    console.log('2. Debe contener: ACCESS_TOKEN=tu-access-token-aqui');
    console.log('');
    process.exit(1);
}

console.log('✅ Access Token encontrado');
console.log('📝 Primeros caracteres:', process.env.ACCESS_TOKEN.substring(0, 30) + '...');
console.log('📏 Longitud total:', process.env.ACCESS_TOKEN.length, 'caracteres');
console.log('');

// Configurar Mercado Pago
try {
    mercadopago.configure({
        access_token: process.env.ACCESS_TOKEN
    });
    console.log('✅ Mercado Pago configurado correctamente');
} catch (error) {
    console.error('❌ Error al configurar Mercado Pago:', error.message);
    process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ================================================
// ENDPOINT: Crear Preferencia de Pago
// ================================================

app.post('/api/create-preference', async (req, res) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 NUEVA SOLICITUD RECIBIDA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        const { 
            package: packageName,
            customerName,
            customerEmail,
            customerPhone,
            travelers,
            departureDate,
            comments,
            unitPrice,
            totalAmount 
        } = req.body;

        console.log('👤 Cliente:', customerName);
        console.log('📧 Email:', customerEmail);
        console.log('📱 Teléfono:', customerPhone);
        console.log('🎫 Paquete:', packageName);
        console.log('👥 Viajeros:', travelers);
        console.log('📅 Fecha:', departureDate);
        console.log('💰 Total:', '$' + totalAmount.toLocaleString('es-MX'), 'MXN');
        if (comments) console.log('💭 Comentarios:', comments);
        console.log('');

        // Validación
        if (!packageName || !customerEmail || !totalAmount) {
            console.log('❌ ERROR: Faltan datos requeridos\n');
            return res.status(400).json({ 
                error: 'Faltan datos requeridos',
                received: { packageName, customerEmail, totalAmount }
            });
        }

        console.log('⏳ Creando preferencia en Mercado Pago...');
        
        // Crear la preferencia
        const preference = {
            items: [
                {
                    title: `${packageName} - Paquete Turístico`,
                    description: `Viaje para ${travelers} persona(s) - Salida: ${departureDate}`,
                    unit_price: Number(unitPrice),
                    quantity: Number(travelers),
                    currency_id: 'MXN'
                }
            ],
            payer: {
                name: customerName,
                email: customerEmail,
                phone: {
                    area_code: '52',
                    number: parseInt(customerPhone)
                }
            },
            back_urls: {
                success: 'http://localhost:8000/payment-status.html?status=success',
                failure: 'http://localhost:8000/payment-status.html?status=failure',
                pending: 'http://localhost:8000/payment-status.html?status=pending'
            },
            auto_return: 'approved',
            payment_methods: {
                installments: 12
            },
            external_reference: `${Date.now()}-${packageName}`,
            metadata: {
                package: packageName,
                travelers: travelers,
                departure_date: departureDate,
                comments: comments
            }
        };

        console.log('📋 Datos de la preferencia preparados');
        console.log('🌐 Enviando a Mercado Pago...');
        
        const response = await mercadopago.preferences.create(preference);

        console.log('');
        console.log('✅ ¡PREFERENCIA CREADA EXITOSAMENTE!');
        console.log('🔑 ID:', response.body.id);
        console.log('🔗 URL de pago:', response.body.init_point);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Retornar la URL de pago
        res.json({
            id: response.body.id,
            init_point: response.body.init_point,
            sandbox_init_point: response.body.sandbox_init_point
        });

    } catch (error) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR AL CREAR PREFERENCIA');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Tipo de error:', error.name);
        console.error('Mensaje:', error.message);
        
        if (error.cause) {
            console.error('Causa:', JSON.stringify(error.cause, null, 2));
        }
        
        if (error.status) {
            console.error('Status HTTP:', error.status);
        }

        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Mensajes de ayuda según el tipo de error
        if (error.message.includes('credentials') || error.message.includes('authentication')) {
            console.log('💡 POSIBLE SOLUCIÓN:');
            console.log('   Tu Access Token parece ser incorrecto.');
            console.log('   1. Ve a https://www.mercadopago.com.mx/developers/panel/app');
            console.log('   2. Copia el Access Token completo');
            console.log('   3. Pégalo en el archivo .env');
            console.log('   4. Reinicia el servidor\n');
        }

        res.status(500).json({ 
            error: 'Error al crear la preferencia de pago',
            message: error.message,
            details: error.cause || error.status || 'Sin detalles adicionales'
        });
    }
});

// ================================================
// WEBHOOK: Notificaciones de Mercado Pago
// ================================================

app.post('/webhook/mercadopago', async (req, res) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔔 WEBHOOK RECIBIDO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Datos:', JSON.stringify(req.body, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = data.id;
            
            console.log('💳 Consultando información del pago...');
            const payment = await mercadopago.payment.findById(paymentId);
            
            console.log('Estado:', payment.body.status);
            console.log('Monto:', payment.body.transaction_amount);
            console.log('Email:', payment.body.payer.email);
            console.log('');

            // Aquí procesarías según el estado
            if (payment.body.status === 'approved') {
                console.log('✅ Pago aprobado - Confirmar reserva');
            } else if (payment.body.status === 'pending') {
                console.log('⏳ Pago pendiente');
            } else if (payment.body.status === 'rejected') {
                console.log('❌ Pago rechazado');
            }
        }

        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Error procesando webhook:', error.message);
        res.sendStatus(500);
    }
});

// ================================================
// RUTA DE PRUEBA
// ================================================

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Backend ViajesÉpica</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 800px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .card {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #009EE3; }
                .status { 
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                code {
                    background: #f8f9fa;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 Backend ViajesÉpica</h1>
                <div class="status">✅ Servidor funcionando correctamente</div>
                <h2>Estado:</h2>
                <ul>
                    <li>Puerto: ${process.env.PORT || 3000}</li>
                    <li>Access Token: Configurado (${process.env.ACCESS_TOKEN.length} caracteres)</li>
                    <li>Mercado Pago: Conectado</li>
                </ul>
                <h2>Endpoints:</h2>
                <ul>
                    <li><code>POST /api/create-preference</code> - Crear pago</li>
                    <li><code>POST /webhook/mercadopago</code> - Recibir notificaciones</li>
                </ul>
            </div>
        </body>
        </html>
    `);
});

// ================================================
// INICIAR SERVIDOR
// ================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SERVIDOR INICIADO CORRECTAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`🌐 Panel de control: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 Endpoints disponibles:');
    console.log(`   POST http://localhost:${PORT}/api/create-preference`);
    console.log(`   POST http://localhost:${PORT}/webhook/mercadopago`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✨ Esperando peticiones...\n');
});

module.exports = app;
