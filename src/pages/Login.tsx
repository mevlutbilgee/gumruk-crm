import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, FileCheck2, LogIn, Ship, Target, Users } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { ROLE_LABELS } from '@/lib/constants';
import { Avatar, Field } from '@/components/ui';

export default function Login() {
  const { user } = usePermissions();
  const users = useDb((d) => d.users.filter((u) => u.active));
  const [email, setEmail] = useState('admin@ornekgumruk.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  if (user) return <Navigate to={from} replace />;

  const submit = (e?: React.FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    const r = actions.login(em, pw);
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
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Şifre" error={error}>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <button className="btn btn-primary" style={{ height: 40 }} type="submit"><LogIn size={16} /> Giriş yap</button>
          </form>

          <div className="divider" />
          <div className="subtle">Demo kullanıcıları (şifre: <b>demo123</b>) — farklı yetkileri denemek için tıklayın:</div>
          <div className="demo-users">
            {users.slice(0, 6).map((u) => (
              <button key={u.id} className="demo-user" onClick={() => submit(undefined, u.email, 'demo123')}>
                <Avatar name={u.name} size="sm" />
                <span style={{ flex: 1 }}>
                  <div className="strong" style={{ fontSize: 13 }}>{u.name}</div>
                  <div className="subtle">{u.email}</div>
                </span>
                <span className="badge tone-primary">{ROLE_LABELS[u.role]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
