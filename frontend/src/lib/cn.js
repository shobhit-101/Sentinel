// Tiny className joiner — drops falsy values so conditional classes stay clean.
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
