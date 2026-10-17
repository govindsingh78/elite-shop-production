import { useContext } from "react";
import { AdminAuthContext } from "../context/AdminAuth";
import { Navigate } from "react-router-dom";

export const AdminRequireAuth = ({ children, role = "admin" }) => {
    const { user } = useContext(AdminAuthContext);

    const roleAllowed = role === "admin"
        ? user?.portal === "admin" && ["admin", "superadmin"].includes(user?.user?.role || user?.role)
        : user?.portal === "vendor" && user?.user?.role === "seller";

    if (!user || !roleAllowed) {
        return <Navigate to={role === "admin" ? "/admin/login" : "/vendor/login"} replace />;
    }

    return children;
};

export default AdminRequireAuth;