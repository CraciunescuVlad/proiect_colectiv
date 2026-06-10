import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth";
import crypto from "crypto";
import nodemailer from "nodemailer";

// ─── Generate random password ─────────────────────────────────────────────────
function generatePassword(length = 12): string {
    const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    return Array.from(crypto.randomBytes(length))
        .map(b => charset[b % charset.length])
        .join("");
}

// ─── Nodemailer config ────────────────────────────────────────────────────────
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

    // ─── POST /create-by-admin ────────────────────────────────────────────────
    router.post("/create-by-admin", requireAuth, async (req: Request, res: Response) => {
        const authUser = (req as any).user;
        if (authUser?.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Only admins can create accounts." });
        }

        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Invalid email address." });
        }

        try {
            const plainPassword = generatePassword();

            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password: plainPassword,
                email_confirm: true,
            });

            if (error) {
                if (error.message.toLowerCase().includes("already")) {
                    return res.status(409).json({ message: "An account with this email already exists." });
                }
                return res.status(400).json({ message: error.message });
            }

            const siteName = process.env.SITE_NAME || "AlarmUP";
            const siteUrl  = process.env.SITE_URL  || "https://example.com";

            await transporter.sendMail({
                from: `"${siteName}" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Your ${siteName} account has been created`,
                html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Welcome to ${siteName}!</h2>
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                            An account has been created for you on
                            <a href="${siteUrl}" style="color: #4f46e5;">${siteName}</a>.
                            Use the credentials below to sign in.
                        </p>
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Username (email)</p>
                            <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #111827;">${email}</p>
                            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Auto-generated password</p>
                            <p style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #4f46e5; font-family: monospace;">${plainPassword}</p>
                        </div>
                        <p style="color: #ef4444; font-size: 12px; margin: 0 0 24px;">
                            Please change your password immediately after your first sign in.
                        </p>
                        <a href="${siteUrl}/login" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                            Sign in now
                        </a>
                    </div>
                `,
            });

            return res.status(201).json({ message: "Account created and email sent successfully." });

        } catch (err: any) {
            console.error("[create-by-admin]", err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });

    // // ─── POST /change-password ────────────────────────────────────────────────
    // router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
    //     const authUser = (req as any).user;
    //
    //     const { oldPassword, newPassword } = req.body;
    //
    //     if (!oldPassword || !newPassword) {
    //         return res.status(400).json({ message: "All fields are required." });
    //     }
    //
    //     if (newPassword.length < 8) {
    //         return res.status(400).json({ message: "New password must be at least 8 characters." });
    //     }
    //
    //     if (!/[A-Z]/.test(newPassword)) {
    //         return res.status(400).json({ message: "Password must contain at least one uppercase letter." });
    //     }
    //
    //     if (!/[0-9]/.test(newPassword)) {
    //         return res.status(400).json({ message: "Password must contain at least one number." });
    //     }
    //
    //     try {
    //         // Verify old password by re-authenticating with Supabase
    //         const { error: signInError } = await supabase.auth.signInWithPassword({
    //             email: authUser.email,
    //             password: oldPassword,
    //         });
    //
    //         if (signInError) {
    //             return res.status(401).json({ message: "Current password is incorrect." });
    //         }
    //
    //         // Update password via Supabase Admin
    //         const { error: updateError } = await supabase.auth.admin.updateUserById(
    //             authUser.id,
    //             { password: newPassword }
    //         );
    //
    //         if (updateError) {
    //             return res.status(400).json({ message: updateError.message });
    //         }
    //
    //         return res.status(200).json({ message: "Password changed successfully." });
    //
    //     } catch (err: any) {
    //         console.error("[change-password]", err);
    //         return res.status(500).json({ message: "Internal server error." });
    //     }
    // });

    return router;
};

export default createUsersRouter;