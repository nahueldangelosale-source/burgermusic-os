"use server";

import { login, logout } from "@/lib/auth";

export async function handleLogin(pin: string) {
    try {
        const user = await login(pin);
        if (!user) {
            return { success: false, message: "Invalid credentials" };
        }
        return { success: true, role: user.role };
    } catch (error) {
        console.error("Login failed:", error);
        return { success: false, message: "System error" };
    }
}

export async function handleLogout() {
    await logout();
}
