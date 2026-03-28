import { useNavigate } from "react-router-dom";

const Login = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Welcome back</h1>
            <input
                type="email"
                placeholder="Email"
                className="border border-gray-300 rounded-lg px-4 py-2 w-72 mb-4"
            />
            <input
                type="password"
                placeholder="Password"
                className="border border-gray-300 rounded-lg px-4 py-2 w-72 mb-4"
            />
            <button
                onClick={() => navigate("/home")}
                className="bg-black text-white px-8 py-2 rounded-lg w-72 cursor-pointer"
            >
                Login
            </button>
        </div>
    );
};

export default Login;