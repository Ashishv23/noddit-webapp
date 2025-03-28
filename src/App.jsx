import './App.css';
import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  Link,
} from 'react-router-dom';

// Set axios defaults
const baseURL = 'https://1573-135-0-96-34.ngrok-free.app/api/v1';

const apiCall = async (method, url, data) => {
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');

  const raw = JSON.stringify(data);

  const requestOptions = {
    method,
    headers: myHeaders,
    body: raw,
    redirect: 'follow',
  };

  // set token
  const token = localStorage.getItem('token');

  if (token) {
    myHeaders.append('Authorization', `Bearer ${token}`);
  }

  myHeaders.append("ngrok-skip-browser-warning", "true");

  const res = await fetch(baseURL + url, requestOptions);

  const result = await res.json();
  return result;
};

// Authentication context
const AuthContext = React.createContext();

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className='admin-panel'>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route
              path='/admin/*'
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            />
            <Route path='*' element={<Navigate to='/login' replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));

        const res = await apiCall('GET', '/users/' + user._id);
        // set token in local storage

        if (res.data.user.role === 'admin') {
          setCurrentUser(res.data.user);
        }

        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      } catch (err) {
        console.log('Not authenticated or not an admin', err);
        throw new Error('Not authenticated or not an admin');
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await apiCall('POST', '/users/signin', { email, password });

      if (res.data.user.role === 'admin') {
        setCurrentUser(res.data);
        // set token in local storage
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        return true;
      } else {
        throw new Error('Not authorized as admin');
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('token');
      setCurrentUser(null);
      await apiCall('GET', '/users/logout');
    } catch (err) {
      console.error(err);
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    isAdmin: currentUser?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return React.useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { currentUser, isAdmin } = useAuth();

  if (!currentUser || !isAdmin) {
    return <Navigate to='/login' replace />;
  }

  return children;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const auth = useAuth();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    const success = await auth.login(email, password);

    if (success) {
      window.location.href = '/admin';
    } else {
      setError('Failed to sign in. Ensure you have admin privileges.');
    }
  };

  if (auth.currentUser) {
    return <Navigate to='/admin' replace />;
  }

  return (
    <div className='login-container'>
      <div className='login-card'>
        <h2>Noddit Admin Panel</h2>
        {error && <div className='alert alert-danger'>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor='email'>Email</label>
            <input
              type='email'
              id='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className='form-group'>
            <label htmlFor='password'>Password</label>
            <input
              type='password'
              id='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type='submit' className='btn-primary'>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminLayout() {
  const auth = useAuth();

  return (
    <div className='admin-layout'>
      <nav className='sidebar'>
        <div className='sidebar-header'>
          <h3>Noddit Admin</h3>
        </div>
        <div className='user-info'>
          <div className='avatar'>
            {auth.currentUser?.username?.charAt(0).toUpperCase()}
          </div>
          <span>{auth.currentUser?.username}</span>
        </div>
        <ul className='sidebar-menu'>
          <li>
            <Link to='/admin'>Dashboard</Link>
          </li>
          <li>
            <Link to='/admin/users'>Users</Link>
          </li>
          <li>
            <Link to='/admin/communities'>Communities</Link>
          </li>
          <li>
            <Link to='/admin/posts'>Posts</Link>
          </li>
          <li>
            <Link to='/admin/comments'>Comments</Link>
          </li>

        </ul>
        <div className='sidebar-footer'>
          <button onClick={auth.logout} className='btn-logout'>
            Logout
          </button>
        </div>
      </nav>

      <main className='content'>
        <div className='top-bar'>
          <div className='search-bar'>
            <input type='text' placeholder='Search...' />
          </div>
          <div className='user-actions'>
            <span>Welcome, {auth.currentUser?.username}</span>
          </div>
        </div>

        <div className='content-body'>
          <Routes>
            <Route path='/' element={<Dashboard />} />
            <Route path='/users' element={<UserManagement />} />
            <Route path='/communities' element={<CommunityManagement />} />
            <Route path='/posts' element={<PostManagement />} />
            <Route path='/comments' element={<CommentManagement />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    userCount: 0,
    communityCount: 0,
    postCount: 0,
    commentCount: 0,
  });

  useEffect(() => {
    // In a real implementation, you would fetch actual stats from your API
    const fetchStats = async () => {
      try {
        // These endpoints would need to be implemented on the backend
        const [users, communities, posts, comments] = await Promise.all([
          apiCall('GET', '/admin/stats/users'),
          apiCall('GET', '/admin/stats/communities'),
          apiCall('GET', '/admin/stats/posts'),
          apiCall('GET', '/admin/stats/comments'),
        ]);

        setStats({
          userCount: users.data.count,
          communityCount: communities.data.count,
          postCount: posts.data.count,
          commentCount: comments.data.count,
        });
      } catch (err) {
        console.error(err);
        // For demo, set mock data
        setStats({
          userCount: 1245,
          communityCount: 86,
          postCount: 12678,
          commentCount: 45923,
        });
      }
    };

    fetchStats();
  }, []);

  return (
    <div className='dashboard'>
      <h1>Dashboard</h1>

      <div className='stats-grid'>
        <div className='stat-card'>
          <h3>Users</h3>
          <div className='stat-value'>{stats.userCount}</div>
        </div>
        <div className='stat-card'>
          <h3>Communities</h3>
          <div className='stat-value'>{stats.communityCount}</div>
        </div>
        <div className='stat-card'>
          <h3>Posts</h3>
          <div className='stat-value'>{stats.postCount}</div>
        </div>
        <div className='stat-card'>
          <h3>Comments</h3>
          <div className='stat-value'>{stats.commentCount}</div>
        </div>
      </div>

      <div className='recent-activity'>
        <h2>Recent Activity</h2>
        <div className='activity-list'>
          <p>
            Coming soon: Activity feed showing recent posts, comments, and user
            registrations
          </p>
        </div>
      </div>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiCall('GET', '/admin/users');
        setUsers(res.data.users);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await apiCall('PATCH', `/admin/users/${userId}`, {
        role: isAdmin ? 'user' : 'admin',
      });

      setUsers(
        users.map(user =>
          user._id === userId
            ? { ...user, role: isAdmin ? 'user' : 'admin' }
            : user
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className='user-management'>
      <h1>User Management</h1>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table className='data-table'>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Karma</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.karma}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() =>
                      handleToggleAdmin(user._id, user.role === 'admin')
                    }
                  >
                    {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CommunityManagement() {
  const [communities, setCommunities] = useState([]);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const res = await apiCall('GET', '/admin/communities');

        setCommunities(res.data.communities);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCommunities();
  }, []);

  return (
    <div className='community-management'>
      <h1>Community Management</h1>

      <table className='data-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Members</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {communities.map(community => (
            <tr key={community._id}>
              <td>{community.name}</td>
              <td>{community.description}</td>
              <td>{community.subscribers?.length || 0}</td>
              <td>{new Date(community.createdAt).toLocaleDateString()}</td>
              <td>
                <button>Edit</button>
                <button className='btn-danger'>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostManagement() {
  return (
    <div className='post-management'>
      <h1>Post Management</h1>
      <p>Implement post moderation capabilities here</p>
    </div>
  );
}

function CommentManagement() {
  return (
    <div className='comment-management'>
      <h1>Comment Management</h1>
      <p>Implement comment moderation capabilities here</p>
    </div>
  );
}



export default App;
