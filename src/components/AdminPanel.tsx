import { FormEvent, useEffect, useState } from 'react';
import { AccessUser, createUser, deleteUser, listUsers, updateUser } from '../authApi';

interface AdminPanelProps {
  currentUserId: string;
}

function AdminPanel({ currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const load = async () => {
    const result = await listUsers();
    setUsers(result.users);
  };

  useEffect(() => {
    load().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load accounts.');
    });
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await createUser(username, password);
      setUsername('');
      setPassword('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add that account.');
    } finally {
      setPending(false);
    }
  };

  const setAccess = async (user: AccessUser, accessEnabled: boolean) => {
    setError('');
    try {
      await updateUser(user.id, { accessEnabled });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update access.');
    }
  };

  const remove = async (user: AccessUser) => {
    if (!window.confirm(`Remove ${user.username}? They will no longer be able to sign in.`)) return;
    setError('');
    try {
      await deleteUser(user.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove that account.');
    }
  };

  return (
    <section className="mb-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-800">Access</h2>
      <p className="mt-1 text-sm text-gray-600">
        Accounts live in the database. Someone can sign in only after you add them here.
      </p>
      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="new-access-username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            id="new-access-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
          />
        </div>
        <div>
          <label htmlFor="new-access-password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="new-access-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 btn disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Give access'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="table-container mt-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Username</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Access</th>
              <th className="py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="py-2 pr-4 text-gray-800">{user.username}</td>
                <td className="py-2 pr-4 text-gray-600">{user.role}</td>
                <td className="py-2 pr-4 text-gray-600">{user.accessEnabled ? 'Allowed' : 'Blocked'}</td>
                <td className="py-2 text-right">
                  {user.id !== currentUserId && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAccess(user, !user.accessEnabled)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {user.accessEnabled ? 'Block' : 'Allow'}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(user)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdminPanel;
