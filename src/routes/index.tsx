import {type RouteObject, Navigate } from "react-router-dom";
import loginRoute from "./login";
import homeRoute from "./home";
import mapRoute from "./map.tsx";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
    homeRoute,
    mapRoute,
];

export default routes;