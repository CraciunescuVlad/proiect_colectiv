import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth";
import crypto from "crypto";
import nodemailer from "nodemailer";

// ─── Generare parola aleatorie ────────────────────────────────────────────────
function generatePassword(length = 12): string {
    const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    return Array.from(crypto.randomBytes(length))
        .map(b => charset[b % charset.length])
        .join("");
}

// ─── Configurare Nodemailer ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const createUsersRouter = (supabase: SupabaseClient) => {
    const router = Router();

    // ─── POST /users/create-by-admin ─────────────────────────────────────────
    router.post("/create-by-admin", requireAuth, async (req: Request, res: Response) => {
        // Verifica rolul de admin
        const authUser = (req as any).user;
        if (authUser?.role !== "admin") {
            return res.status(403).json({ message: "Acces interzis. Doar adminii pot crea conturi." });
        }

        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Email invalid." });
        }

        try {
            const plainPassword = generatePassword();

            // Creeaza userul prin Supabase Admin Auth
            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password: plainPassword,
                email_confirm: true, // contul e activ imediat, fără verificare email
            });

            if (error) {
                // Supabase returneaza eroare specifica daca emailul exista deja
                if (error.message.toLowerCase().includes("already")) {
                    return res.status(409).json({ message: "Există deja un cont cu acest email." });
                }
                return res.status(400).json({ message: error.message });
            }

            // Trimite emailul cu credentialele
            const siteName = process.env.SITE_NAME || "AlarmUP";
            const siteUrl  = process.env.SITE_URL  || "https://example.com";

            await transporter.sendMail({
                from: `"${siteName}" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Contul tău pe ${siteName} a fost creat`,
                html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Bun venit pe ${siteName}!</h2>
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                            Tocmai ți-a fost creat un cont pe
                            <a href="${siteUrl}" style="color: #4f46e5;">${siteName}</a>.
                            Folosește credențialele de mai jos pentru a te autentifica.
                        </p>
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Username (email)</p>
                            <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #111827;">${email}</p>
                            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Parolă generată automat</p>
                            <p style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #4f46e5; font-family: monospace;">${plainPassword}</p>
                        </div>
                        <p style="color: #ef4444; font-size: 12px; margin: 0 0 24px;">
                            ⚠️ Te rugăm să îți schimbi parola imediat după prima autentificare.
                        </p>
                        <a href="${siteUrl}/login" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                            Autentifică-te acum →
                        </a>
                        <p style="margin: 24px 0 0; font-size: 11px; color: #9ca3af;">
                            Dacă nu ai solicitat acest cont, poți ignora acest email.
                        </p>
                    </div>
                `,
            });

            return res.status(201).json({ message: "Cont creat și email trimis cu succes." });

        } catch (err: any) {
            console.error("[create-by-admin]", err);
            return res.status(500).json({ message: "Eroare internă de server." });
        }
    });

    return router;
};

export default createUsersRouter;

