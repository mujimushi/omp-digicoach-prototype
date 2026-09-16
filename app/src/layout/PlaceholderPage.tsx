import { ds } from '../styles/tokens.ts';

/** Stands in for a screen until its lane builds it. */
export function PlaceholderPage({ name }: { name: string }) {
  return (
    <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 20px 20px' }}>
      <h1
        style={{ fontSize: 24, fontWeight: 700, color: ds.warmDk, margin: 0 }}
      >
        {name}
      </h1>
    </div>
  );
}

export function NotFound() {
  return <PlaceholderPage name="Page not found" />;
}
