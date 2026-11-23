import { FormEvent, useState } from 'react';

interface AdminSetupProps {
  onSubmit: (username: string, password: string) => Promise<void>;
}

function AdminSetup({ onSubmit }: AdminSetupProps) {
  const [username, setUsername] = useState('ryskipperdev');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await onSubmit(username, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the admin account.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-center">Create your admin account</h2>
      <p className="mb-6 text-sm text-center text-gray-600">
        This account is stored in the database. After this, only people you add can sign in.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            id="admin-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="admin-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
            minLength={8}
          />
        </div>
        <div>
          <label htmlFor="admin-confirm" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <input
            type="password"
            id="admin-confirm"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 btn disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Create admin account'}
        </button>
      </form>
    </div>
  );
}

export default AdminSetup;
