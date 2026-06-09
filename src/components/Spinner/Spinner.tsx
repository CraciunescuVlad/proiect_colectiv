// Renders a small spinning loader sized in pixels
export default function Spinner({ size = 18 }: { size?: number }) {
    return (
        <span
            className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-white/80"
            style={{ width: size, height: size }}
        />
    );
}