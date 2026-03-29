import type {RouteObject} from "react-router-dom";
import MapPage from "../components/Map/MapPage.tsx";

const mapRoute: RouteObject = {
    path: "/map",
    element: <MapPage />,
};

export default mapRoute;