// Backdrop for the whole app: a faint dot grid plus a soft violet glow.
// Sits at the back of the DOM so opaque panels cover it.
export default function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1.5px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 100% 78% at 50% 0%, #000 45%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 78% at 50% 0%, #000 45%, transparent 100%)',
        }}
      />
      {/* soft violet glow, top-centre */}
      <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-accent/10 blur-[170px]" />
    </div>
  );
}
