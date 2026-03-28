import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Mock users — replace with DB later
const mockUsers = [
    { id: 1, email: "test@test.com", password: "1234", name: "Test User" },
    { id: 2, email: "admin@admin.com", password: "admin", name: "Admin" },
];

app.post("/auth/login", (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = mockUsers.find(
        (u) => u.email === email && u.password === password
    );

    if (!user) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
    );

    res.json({ token });
});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));