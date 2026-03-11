import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";

async function seedUsers() {
    console.log("🔒 Inicializando Protocolo de Seguridad...");

    const initialUsers = [
        {
            id: "usr_manager_001",
            name: "Admin Principal",
            role: "MANAGER" as const,
            pin_hash: "admin123", // NOTA: En producción, hashear esto (bcrypt/argon2)
        },
        {
            id: "usr_kitchen_001",
            name: "Estación Cocina Noche",
            role: "KITCHEN" as const,
            pin_hash: "1234", // PIN simple para velocidad operativa
        },
        {
            id: "usr_receiver_001",
            name: "Recepción de Mercadería",
            role: "RECEIVER" as const,
            pin_hash: "9999",
        },
    ];

    try {
        await db.insert(users).values(initialUsers).onConflictDoNothing();
        console.log("✅ Usuarios iniciales creados: Manager, Cocina y Receiver.");
    } catch (error) {
        console.error("❌ Error en seeding de usuarios:", error);
    }
}

seedUsers();
