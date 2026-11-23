import { FormEvent, useState } from 'react';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
}

function LoginForm({ onSubmit }: LoginFormProps) {
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      await onSubmit({
        username: String(data.get('username') || ''),
        password: String(data.get('password') || ''),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 btn disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Sign-in is limited to accounts an admin has added.
      </p>
    </div>
  );
}

export default LoginForm;
