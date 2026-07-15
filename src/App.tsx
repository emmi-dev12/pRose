import { useCallback, useEffect, useRef, useState } from 'react';
import { indexedDbStorage as store } from './storage';
import { forgetPass, rememberPass, savedPass } from './session';
import { newVolume, type Library, type Volume, type VolumeLook } from './types';
import { Notebook } from './components/Notebook';
import { VolumeSetup } from './components/VolumeSetup';
import { Shelf } from './components/Shelf';

type Phase = 'checking' | 'locked' | 'ready';

// tiny hash router: '#/', '#/new', '#/v/<slug>'
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function navigate(hash: string) {
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function App() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [hasNotebook, setHasNotebook] = useState(false);
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<Library | null>(null);
  const passRef = useRef('');
  const route = useHashRoute();

  // boot: auto-unlock from a saved session if one exists
  useEffect(() => {
    (async () => {
      const exists = await store.exists();
      setHasNotebook(exists);
      const saved = savedPass();
      if (exists && saved) {
        try {
          const lib = await store.load(saved);
          passRef.current = saved;
          setLibrary(lib);
          setPhase('ready');
          return;
        } catch {
          forgetPass(); // stale/invalid saved pass
        }
      }
      setPhase('locked');
    })();
  }, []);

  const unlock = useCallback(async () => {
    setError('');
    try {
      if (hasNotebook) {
        const lib = await store.load(pass); // throws on wrong passphrase
        passRef.current = pass;
        if (remember) rememberPass(pass);
        setLibrary(lib);
        setPhase('ready');
        navigate('#/');
      } else {
        // brand-new device: hold the passphrase, start an empty library
        passRef.current = pass;
        if (remember) rememberPass(pass);
        setLibrary({ volumes: [] });
        setPhase('ready');
        navigate('#/new');
      }
      setPass('');
    } catch {
      setError('That passphrase doesn’t open this notebook.');
    }
  }, [hasNotebook, pass, remember]);

  const persist = useCallback(async (lib: Library) => {
    await store.save(passRef.current, lib);
  }, []);

  // autosave (encrypted) shortly after any change to a volume
  const saveTimer = useRef<number>();
  const onChangeVolume = useCallback((v: Volume) => {
    setLibrary((lib) => {
      if (!lib) return lib;
      const next = { volumes: lib.volumes.map((x) => (x.id === v.id ? v : x)) };
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => store.save(passRef.current, next), 400);
      return next;
    });
  }, []);

  const createVolume = useCallback(
    async (title: string, look: VolumeLook) => {
      const taken = library?.volumes.map((v) => v.slug) ?? [];
      const v = newVolume(title, look, taken);
      const next = { volumes: [...(library?.volumes ?? []), v] };
      await persist(next); // must succeed before we leave setup
      setLibrary(next);
      navigate(`#/v/${v.slug}`);
    },
    [library, persist],
  );

  const deleteVolume = useCallback(
    async (v: Volume) => {
      if (!window.confirm(`Delete “${v.title}” and everything in it? This can’t be undone.`)) return;
      const next = { volumes: (library?.volumes ?? []).filter((x) => x.id !== v.id) };
      setLibrary(next);
      await persist(next);
      navigate('#/');
    },
    [library, persist],
  );

  const lock = useCallback(() => {
    forgetPass();
    passRef.current = '';
    setLibrary(null);
    setPhase('locked');
    setPass('');
    navigate('#/');
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
              ? 'Enter your passphrase to open your shelf.'
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
          <label className="stay">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Stay unlocked on this device
          </label>
          {error && <div className="lock-error">{error}</div>}
        </div>
      </div>
    );
  }

  // phase === 'ready' — routed views over the library
  if (!library) return null;

  if (route === '#/new') {
    return <VolumeSetup onComplete={createVolume} onCancel={library.volumes.length ? () => navigate('#/') : undefined} />;
  }

  const m = route.match(/^#\/v\/(.+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const vol = library.volumes.find((v) => v.slug === slug);
    if (vol) {
      return <Notebook key={vol.id} volume={vol} onChange={onChangeVolume} onBack={() => navigate('#/')} />;
    }
    navigate('#/'); // unknown slug → shelf
  }

  return (
    <Shelf
      library={library}
      onOpen={(slug) => navigate(`#/v/${slug}`)}
      onNew={() => navigate('#/new')}
      onLock={lock}
      onDelete={deleteVolume}
    />
  );
}
