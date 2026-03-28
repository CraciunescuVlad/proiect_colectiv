import type {RouteObject} from "react-router-dom";
import Map from "../components/Map/Map";

const mapRoute: RouteObject = {
    path: "/harta",
    element: <Map />,
};

export default mapRoute;