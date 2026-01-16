import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Key, ArrowRight } from 'lucide-react';

function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If already logged in, redirect to home
        const session = sessionStorage.getItem('auth_session');
        if (session) {
            navigate('/');
        }

        // --- MIGRATION & INITIALIZATION LOGIC ---
        const users = localStorage.getItem('users');
        const oldCreds = localStorage.getItem('user_credentials');

        if (!users) {
            if (oldCreds) {
                // Migrate old single-user credential to new array format as Admin
                try {
                    const parsedOld = JSON.parse(oldCreds);
                    const newUsers = [{
                        username: parsedOld.username || 'admin',
                        password: parsedOld.password || 'admin',
                        role: 'admin' // Grant admin to existing user
                    }];
                    localStorage.setItem('users', JSON.stringify(newUsers));
                    localStorage.removeItem('user_credentials'); // Clean up
                } catch (e) {
                    console.error('Migration failed, resetting to default', e);
                    initializeDefault();
                }
            } else {
                // No data at all, initialize default admin
                initializeDefault();
            }
        }
    }, [navigate]);

    const initializeDefault = () => {
        localStorage.setItem('users', JSON.stringify([{
            username: 'admin',
            password: 'admin',
            role: 'admin'
        }]));
    };

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Simulate network delay for feel
            setTimeout(() => {
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const user = users.find(u => u.username === username && u.password === password);

                if (user) {
                    // Login Success
                    sessionStorage.setItem('auth_session', JSON.stringify({
                        username: user.username,
                        role: user.role, // Store role in session
                        loginFullTime: new Date().toISOString()
                    }));
                    navigate('/');
                } else {
                    setError('Invalid username or password');
                    setIsLoading(false);
                }
            }, 600);
        } catch (err) {
            setError('An error occurred. Please clear browser data.');
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f6f9fc 0%, #eef2f6 100%)',
            padding: '20px'
        }}>
            <div className="card animate-in" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '40px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #635bff 0%, #a259ff 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        color: 'white',
                        boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.3)'
                    }}>
                        <Lock size={32} />
                    </div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Please sign in to continue</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Username
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9ca3af'
                            }}>
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                className="input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                style={{ paddingLeft: '40px', height: '44px' }}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9ca3af'
                            }}>
                                <Key size={18} />
                            </div>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                style={{ paddingLeft: '40px', height: '44px' }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="status-error" style={{
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            marginBottom: '24px',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', height: '44px', fontSize: '15px' }}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px', borderTopColor: 'white', borderRightColor: 'rgba(255,255,255,0.4)', borderBottomColor: 'rgba(255,255,255,0.4)', borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                        ) : (
                            <>
                                Sign In <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                            </>
                        )}
                    </button>

                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Default credentials: <strong>admin / admin</strong>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LoginPage;
