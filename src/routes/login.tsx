import type {RouteObject} from "react-router-dom";
import Login from "../components/Login/Login";

const loginRoute: RouteObject = {
    path: "/login",
    element: <Login />,
};

export default loginRoute;