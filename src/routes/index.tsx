import { type RouteObject, Navigate } from "react-router-dom";
import loginRoute from "./login";
import callbackRoute from "./callback.tsx";
import signupRoute from "./signup.tsx";
import MainLayout from "../layouts/MainLayout";
import Home from "../components/Home/Home";
import MapPage from "../components/Map/MapPage";
import ProtectedRoute from "../components/ProtectedRoute";
import Statistics from "../components/Statistics/Statistics";
import Signup from "../components/Signup/Signup";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
    signupRoute,
    callbackRoute,
    {
        element: (
            <ProtectedRoute>
                <MainLayout />
            </ProtectedRoute>
        ),
        children: [
            { path: "/home", element: <Home /> },
            { path: "/harta", element: <MapPage /> },
            { path: "/statistics", element: <Statistics /> },
            { path: "/signup", element: <Signup /> },
        ],
    },
];

export default routes;