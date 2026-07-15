import { useCallback, useEffect, useRef, useState } from 'react';
import { indexedDbStorage as store } from './storage';
import { newVolume, type Volume, type VolumeLook } from './types';
import { Notebook } from './components/Notebook';
import { VolumeSetup } from './components/VolumeSetup';

type Phase = 'checking' | 'locked' | 'create' | 'ready';

export function App() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [hasNotebook, setHasNotebook] = useState(false);
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState<Volume | null>(null);
  const passRef = useRef('');

  useEffect(() => {
    store.exists().then((e) => {
      setHasNotebook(e);
      setPhase('locked');
    });
  }, []);

  const unlock = useCallback(async () => {
    setError('');
    try {
      if (hasNotebook) {
        const v = await store.load(pass); // throws on wrong passphrase
        passRef.current = pass;
        setVolume(v);
        setPhase('ready');
      } else {
        // new writer: hold the passphrase and go dress the first volume
        passRef.current = pass;
        setPhase('create');
      }
      setPass('');
    } catch {
      setError('That passphrase doesn’t open this notebook.');
    }
  }, [hasNotebook, pass]);

  // may throw if storage is unavailable (quota, private-mode); VolumeSetup surfaces it
  const createVolume = useCallback(async (title: string, look: VolumeLook) => {
    const v = newVolume(title, look);
    await store.save(passRef.current, v); // must succeed before we leave setup
    setVolume(v);
    setPhase('ready');
  }, []);

  // autosave (encrypted) shortly after any change
  const saveTimer = useRef<number>();
  const onChange = useCallback((v: Volume) => {
    setVolume(v);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      store.save(passRef.current, v);
    }, 400);
  }, []);

  if (phase === 'checking') return <div className="boot" />;

  if (phase === 'locked') {
    return (
      <div className="lock">
        <div className="lock-card">
          <div className="lock-rose">🥀</div>
          <h1>pRose</h1>
          <p>
            {hasNotebook
              ? 'Enter your passphrase to open your notebook.'
              : 'Choose a passphrase. It encrypts everything on this device — there is no way to recover it, and nothing ever leaves your machine.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pass) unlock();
            }}
          >
            <input
              type="password"
              autoFocus
              value={pass}
              placeholder="passphrase"
              onChange={(e) => setPass(e.target.value)}
            />
            <button type="submit" disabled={!pass}>
              {hasNotebook ? 'Open' : 'Begin'}
            </button>
          </form>
          {error && <div className="lock-error">{error}</div>}
        </div>
      </div>
    );
  }

  if (phase === 'create') {
    return <VolumeSetup onComplete={createVolume} />;
  }

  return volume ? <Notebook volume={volume} onChange={onChange} /> : null;
}
