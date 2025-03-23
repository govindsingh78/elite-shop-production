import { createContext, useState } from "react";

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
    const admin = localStorage.getItem('admin');
    const [user, setUser] = useState(admin);
    const login = (user) => {
        setUser(user);
    };

    const logout = () => {
        localStorage.removeItem('admin');
        setUser(null);
    };

    return (
        <AdminAuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
};