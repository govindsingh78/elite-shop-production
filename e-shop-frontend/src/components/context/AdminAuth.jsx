import { createContext, useState } from "react";

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
    const savedUser = localStorage.getItem("authUser") || localStorage.getItem("admin");
    const [user, setUser] = useState(() => {
        try {
            if (!savedUser) return null;
            const parsed = JSON.parse(savedUser);
            // Upgrade existing admin sessions created before portal-specific auth was added.
            if (!localStorage.getItem("authUser") && ["admin", "superadmin"].includes(parsed?.user?.role)) {
                parsed.portal = "admin";
                localStorage.setItem("authUser", JSON.stringify(parsed));
                if (parsed.token) localStorage.setItem("authToken", parsed.token);
            }
            return parsed;
        } catch {
            return null;
        }
    });
    const login = (authData) => {
        localStorage.setItem("authUser", JSON.stringify(authData));
        localStorage.setItem("authToken", authData.token);
        if (authData.portal === "admin") {
            localStorage.setItem("admin", JSON.stringify(authData));
            localStorage.setItem("adminToken", authData.token);
        } else if (authData.portal === "vendor") {
            localStorage.setItem("vendor", JSON.stringify(authData));
            localStorage.setItem("vendorToken", authData.token);
        }
        setUser(authData);
    };

    const logout = () => {
        ["admin", "adminToken", "vendor", "vendorToken", "authUser", "authToken"].forEach((key) => localStorage.removeItem(key));
        setUser(null);
    };

    return (
        <AdminAuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
};