import { Link, useMatch, useNavigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { clearAccessToken, isAuthenticated } from '../lib/auth';

export function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const isMapResultsPage = useMatch('/results/:routeRequestId') !== null;

  const handleLogout = (): void => {
    clearAccessToken();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${isMapResultsPage ? 'app-shell--map' : ''}`}>
      <header className={`site-header ${isMapResultsPage ? 'site-header--map' : ''}`}>
        <Link to="/" className="brand">
          Adventure Route
        </Link>
        <nav className="site-nav">
          <Link to="/plan">Plan Route</Link>
          {isAuthenticated() ? (
            <button type="button" className="text-button" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className={`page-container ${isMapResultsPage ? 'page-container--map' : ''}`}>
        {children}
      </main>
    </div>
  );
}
