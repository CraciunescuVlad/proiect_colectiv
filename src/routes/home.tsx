import type {RouteObject} from "react-router-dom";
import Home from "../components/Home/Home";

const homeRoute: RouteObject = {
    path: "/home",
    element: <Home />,
};

export default homeRoute;