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
import IncidentPage from "../components/Incident/IncidentPage.tsx";
import AdminRequestsPage from "../components/AdminRequests/AdminRequestsPage.tsx";
import ProfilePage from "../components/Profile/ProfilePage.tsx";
import ChangePassword from "../components/ChangePassword/ChangePassword.tsx";
import AdminHistoryPage from "../components/AdminHistory/AdminHistoryPage.tsx";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
    signupRoute,
    callbackRoute,
    { path: "/change-password", element: <ChangePassword /> },
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
            { path: "/incident/:id", element: <IncidentPage /> },
            { path: "/admin-requests", element: <AdminRequestsPage /> },
            { path: "/history", element: <AdminHistoryPage /> },
            { path: "/profile", element: <ProfilePage /> },
        ],
    },
];

export default routes;