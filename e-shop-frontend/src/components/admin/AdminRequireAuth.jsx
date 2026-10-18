import { useContext } from "react";
import { AdminAuthContext } from "../context/AdminAuth";
import { Navigate, useLocation } from "react-router-dom";

const loginPaths = { admin: "/admin/login", vendor: "/vendor/login", customer: "/customer/login" };

export const AdminRequireAuth = ({ children, role = "admin" }) => {
    const { user } = useContext(AdminAuthContext);
    const location = useLocation();
    const accountRole = user?.user?.role || user?.role;

    const roleAllowed = {
        admin: user?.portal === "admin" && ["admin", "superadmin"].includes(accountRole),
        vendor: user?.portal === "vendor" && accountRole === "seller",
        customer: user?.portal === "customer" && accountRole === "customer",
    }[role];

    if (!user || !roleAllowed) {
        return <Navigate to={loginPaths[role]} replace state={{ from: location.pathname }} />;
    }

    return children;
};

export default AdminRequireAuth;
