import type {RouteObject} from "react-router-dom";
import AuthCallback from "../components/AuthCallBack/AuthCallBack.tsx";

const callbackRoute: RouteObject = {
    path: "/auth/callback",
    element: <AuthCallback />,
};

export default callbackRoute;