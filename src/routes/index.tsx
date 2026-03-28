import {type RouteObject, Navigate } from "react-router-dom";
import loginRoute from "./login";
import homeRoute from "./home";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
    homeRoute,
];

export default routes;