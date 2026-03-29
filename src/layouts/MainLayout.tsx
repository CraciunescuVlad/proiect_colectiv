import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar/Sidebar";

const MainLayout = () => {
    return (
        <div className="flex">
            <Sidebar />
            <main className="ml-16 flex-1 min-h-screen bg-[#060010] relative transition-all duration-300">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;