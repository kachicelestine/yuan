const colors = ["#ff7a52", "#ffc53d", "#7fe0b4", "#c9b6ff", "#4da3ff", "#ff3b5c"];

/** A one-shot burst of falling paper for big moments, like a placed order. Off with reduced motion. */
export function Confetti({ pieces = 56 }: { pieces?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden">
      {Array.from({ length: pieces }, (_, i) => {
        // Spread by a fixed stride rather than Math.random, so server and client agree.
        const left = (i * 37) % 100;
        const style = {
          left: `${left}%`,
          width: `${6 + (i % 4) * 2}px`,
          height: `${10 + (i % 3) * 4}px`,
          background: colors[i % colors.length],
          animationDelay: `${(i % 14) * 0.07}s`,
          borderRadius: i % 5 === 0 ? "999px" : "2px",
          "--drift": `${((i * 53) % 160) - 80}px`,
          "--spin": `${360 + ((i * 97) % 540)}deg`,
        } as React.CSSProperties;
        return <span key={i} className="absolute top-0 block animate-confetti" style={style} />;
      })}
    </div>
  );
}
