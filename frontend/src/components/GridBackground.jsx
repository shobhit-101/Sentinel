// Faint grid texture behind the whole app. Sits at the back of the DOM so
// opaque panels (sidebar, cards) cover it and it only shows in the gutters.
export default function GridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),' +
          'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '46px 46px',
        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 35%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 35%, transparent 100%)',
      }}
    />
  );
}
