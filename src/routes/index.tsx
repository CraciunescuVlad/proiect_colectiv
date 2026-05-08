// import { type RouteObject, Navigate } from "react-router-dom";
// import loginRoute from "./login";
// import signupRoute from "./signup";
// import callbackRoute from "./callback.tsx";
// import MainLayout from "../layouts/MainLayout";
// import Home from "../components/Home/Home";
// import MapPage from "../components/Map/MapPage";
//
// const routes: RouteObject[] = [
//     {
//         path: "/",
//         element: <Navigate to="/login" replace />,
//     },
//     loginRoute,
//     signupRoute,
//     callbackRoute,
//     {
//         element: <MainLayout />,
//         children: [
//             { path: "/home", element: <Home /> },
//             { path: "/map", element: <MapPage /> },
//         ],
//     },
// ];
//
// export default routes;

import { type RouteObject, Navigate } from "react-router-dom";
import loginRoute from "./login";
import callbackRoute from "./callback.tsx";
import MainLayout from "../layouts/MainLayout";
import Home from "../components/Home/Home";
import MapPage from "../components/Map/MapPage";
import ProtectedRoute from "../components/ProtectedRoute";
import Statistics from "../components/Statistics/Statistics";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
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
        ],
    },
];

export default routes;