import { useNavigate } from "react-router-dom";
import BorderGlow from "../BorderGlow/BorderGlow";

const cards = [
    {
        title: "Statistici",
        description: "Apasa pentru a vedea statisticile",
        route: "/statistici",
    },
    {
        title: "Catre Harta",
        description: "Apasa pentru a vedea harta",
        route: "/harta",
    },
];

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#060010] gap-12">

            <div className="text-center">
                <h1 className="text-white text-4xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-white/40 text-sm mt-2">Alege o sectiune</p>
            </div>

            <div className="flex items-center gap-6">
                {cards.map((card) => (
                    <BorderGlow
                        key={card.title}
                        className="w-72 p-8 cursor-pointer"
                        animated={true}
                        backgroundColor="#060010"
                        colors={['#c084fc', '#f472b6', '#38bdf8']}
                        onClick={() => navigate(card.route)}
                    >
                        <h2 className="text-white text-xl font-semibold mb-2">{card.title}</h2>
                        <p className="text-white/50 text-sm leading-relaxed">{card.description}</p>
                    </BorderGlow>
                ))}
            </div>

        </div>
    );
};

export default Home;