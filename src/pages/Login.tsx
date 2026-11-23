import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, FileCheck2, LogIn, Ship, Target, Users } from 'lucide-react';
import { actions, usePermissions, useSessionReady } from '@/data/store';
import { Field } from '@/components/ui';

export default function Login() {
  const { user } = usePermissions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const ready = useSessionReady();
  if (!ready) return null;
  if (user) return <Navigate to={from} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await actions.login(email, password);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else navigate(from, { replace: true });
  };

  return (
    <div className="login">
      <div className="login__aside">
        <div className="row" style={{ gap: 12 }}>
          <div className="sidebar__logo"><Ship size={18} /></div>
          <div className="sidebar__name">GümrükCRM</div>
        </div>
        <div>
          <h2>Gümrük hizmetleriniz için tek panelden müşteri yönetimi.</h2>
          <p>Müşteri portföyünüzü, hizmet paketlerinizi, tahsilatlarınızı ve potansiyel müşterilerinizi tek yerden takip edin.</p>
          <div className="login__features">
            <div className="login__feature"><span><Users size={17} /></span> Paket bazlı müşteri yönetimi & indirimler</div>
            <div className="login__feature"><span><BellRing size={17} /></span> Yaklaşan ödemeler için otomatik e-posta</div>
            <div className="login__feature"><span><Target size={17} /></span> Satış hunisi ve aday takibi</div>
            <div className="login__feature"><span><FileCheck2 size={17} /></span> Rol bazlı yetkilendirme & denetim kaydı</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#7d8aa3' }}>© {new Date().getFullYear()} GümrükCRM</div>
      </div>

      <div className="login__form">
        <div className="login__box">
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Tekrar hoş geldiniz</h1>
          <p className="muted" style={{ marginTop: 6 }}>Panele erişmek için giriş yapın.</p>
          <form onSubmit={submit} className="stack" style={{ marginTop: 24, gap: 14 }}>
            <Field label="E-posta">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required />
            </Field>
            <Field label="Şifre" error={error}>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            <button className="btn btn-primary" style={{ height: 40 }} type="submit" disabled={busy}><LogIn size={16} /> {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}</button>
          </form>

        </div>
      </div>
    </div>
  );
}
