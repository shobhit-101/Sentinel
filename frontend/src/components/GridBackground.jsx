// App backdrop: an abstract violet-tinted grid that fades out smoothly,
// with two soft violet glows. Sits behind everything on a true-black page.
export default function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* violet grid, large cells, masked to a smooth fade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(139,92,246,0.08) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(139,92,246,0.08) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 95% 80% at 50% 20%, #000 25%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 95% 80% at 50% 20%, #000 25%, transparent 95%)',
        }}
      />
      {/* violet glow accents */}
      <div className="absolute -top-48 left-1/3 w-[760px] h-[520px] rounded-full bg-accent/12 blur-[170px]" />
      <div className="absolute top-1/4 -right-32 w-[520px] h-[520px] rounded-full bg-accent/10 blur-[180px]" />
    </div>
  );
}
