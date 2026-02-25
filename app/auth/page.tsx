'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const login = (form.elements.namedItem('login') as HTMLInputElement)?.value || '';
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value || '';

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: login, username: login, password }),
    });

    if (res.ok) {
      const data = await res.json();

      if (data.role === 'admin') {
        localStorage.setItem('isAdmin', 'true');
        router.push('/admin');
      } else {
        localStorage.setItem('isAdmin', 'false');
        router.push('/');
      }
    } else {
      setError('Invalid login credentials');
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    const user = {
      username: (form.elements.namedItem('username') as HTMLInputElement)?.value || '',
      name: (form.elements.namedItem('name') as HTMLInputElement)?.value || '',
      surname: (form.elements.namedItem('surname') as HTMLInputElement)?.value || '',
      email: (form.elements.namedItem('email') as HTMLInputElement)?.value || '',
      phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
      password: (form.elements.namedItem('password') as HTMLInputElement)?.value || '',
    };

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    if (res.ok) {
      alert('Registration successful! You can now log in.');
      setMode('login');
    } else {
      setError('Registration failed');
    }
  }

  return (
    <div className="form-container">
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button onClick={() => setMode('login')}>Login</button>
        <button onClick={() => setMode('register')}>Register</button>
      </div>

      {mode === 'login' && (
        <>
          <h1>Login</h1>
          <form onSubmit={handleLogin}>
            <label>Username or Email:</label>
            <input name="login" required autoComplete="username" />

            <label>Password:</label>
            <input type="password" name="password" required autoComplete="current-password" />

            <button type="submit">Login</button>
          </form>
        </>
      )}

      {mode === 'register' && (
        <>
          <h1>Register</h1>
          <form onSubmit={handleRegister}>
            <label>Username:</label>
            <input name="username" required />

            <label>Name:</label>
            <input name="name" required />

            <label>Surname:</label>
            <input name="surname" required />

            <label>Email:</label>
            <input type="email" name="email" required />

            <label>Phone:</label>
            <input type="tel" name="phone" required />

            <label>Password:</label>
            <input type="password" name="password" required />

            <button type="submit">Register</button>
          </form>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
