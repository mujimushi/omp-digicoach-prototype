import { APP_NAME } from '@omp/shared';
import { InstallNotice } from '../install/InstallNotice.tsx';
import { ds } from '../styles/tokens.ts';
import { Logo } from './Logo.tsx';

/** Shown while the app checks who is logged in. */
export function Splash() {
  return (
    <main
      aria-busy="true"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: ds.cream,
        padding: 24,
      }}
    >
      <Logo size={72} />
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: ds.warmDk,
          margin: '14px 0 0',
        }}
      >
        {APP_NAME}
      </h1>
      <div style={{ width: '100%', maxWidth: 420, marginTop: 24 }}>
        <InstallNotice />
      </div>
    </main>
  );
}
