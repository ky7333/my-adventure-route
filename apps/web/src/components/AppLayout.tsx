import { Link, useMatch, useNavigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { clearAccessToken, isAuthenticated } from '../lib/auth';

export function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const isMapPlanPage = useMatch('/plan') !== null;
  const isLegacyResultsPath = useMatch('/results/:routeRequestId') !== null;
  const isMapLayout = isMapPlanPage || isLegacyResultsPath;

  const handleLogout = (): void => {
    clearAccessToken();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${isMapLayout ? 'app-shell--map' : ''}`}>
      <header className={`site-header ${isMapLayout ? 'site-header--map' : ''}`}>
        <Link to="/" className="brand">
          My Adventure Route
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
      <main className={`page-container ${isMapLayout ? 'page-container--map' : ''}`}>
        {children}
      </main>
    </div>
  );
}
