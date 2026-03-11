import 'dotenv/config'; // Carga .env para el script local
import { db } from './index'; // Tu conexión exportada
import { products, users } from './schema';

async function seed() {
    console.log('🌱 Sembrando base de datos...');

    // Limpiamos products existentes para evitar duplicados de IDs viejos
    // (Opcional, pero recomendable en dev)
    try {
        // await db.delete(products); // Descomentar si quieres limpiar
    } catch (e) { }

    const items = [
        {
            id: 'CARNE_HAMBURGUESA',
            name: 'Carne Hamburguesa',
            unit: 'bolsa',
            synonyms: ['paty', 'medallon', 'carne', 'hamburguesas'],
            isSaleable: false
        },
        {
            id: 'PAN_PAPA',
            name: 'Pan de Papa',
            unit: 'paquete',
            synonyms: ['panes', 'buns', 'pancho'],
            isSaleable: false
        },
        {
            id: 'QUESO_CHEDDAR',
            name: 'Queso Cheddar',
            unit: 'feta',
            synonyms: ['cheddar', 'queso', 'fetras'],
            isSaleable: false
        },
        {
            id: 'TOMATE_REDONDO',
            name: 'Tomate Redondo',
            unit: 'kg',
            synonyms: ['tomates', 'tomatitos'],
            isSaleable: false
        },
        {
            id: 'LECHUGA_CAPUCHINA',
            name: 'Lechuga Capuchina',
            unit: 'kg',
            synonyms: ['lechuga', 'verde'],
            isSaleable: false
        },
    ];

    await db.insert(products).values(items).onConflictDoNothing();

    // Sembrar Manager Default (PIN: 1234)
    const bcrypt = await import('bcryptjs');
    const hashedPin = await bcrypt.hash('1234', 10);
    
    await db.insert(users).values({
        id: 'admin',
        name: 'Manager',
        role: 'MANAGER',
        pin_hash: hashedPin
    }).onConflictDoNothing();

    console.log('✅ Base de datos poblada con 5 productos y Manager (PIN: 1234).');
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exit(1);
});
