// import {type RouteObject, Navigate } from "react-router-dom";
// import loginRoute from "./login";
// import homeRoute from "./home";
// import mapRoute from "./map.tsx";
// import callbackRoute from "./callback.tsx";
//
// const routes: RouteObject[] = [
//     {
//         path: "/",
//         element: <Navigate to="/login" replace />,
//     },
//     loginRoute,
//     homeRoute,
//     mapRoute,
//     callbackRoute,
// ];
//
// export default routes;


import { type RouteObject, Navigate } from "react-router-dom";
import loginRoute from "./login";
import signupRoute from "./signup";
import callbackRoute from "./callback.tsx";
import MainLayout from "../layouts/MainLayout";
import Home from "../components/Home/Home";
import MapPage from "../components/Map/MapPage";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Navigate to="/login" replace />,
    },
    loginRoute,
    signupRoute,
    callbackRoute,
    {
        element: <MainLayout />,
        children: [
            { path: "/home", element: <Home /> },
            { path: "/map", element: <MapPage /> },
        ],
    },
];

export default routes;