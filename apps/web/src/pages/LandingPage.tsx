import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <section className="hero">
      <p className="eyebrow">MVP Adventure Routing</p>
      <h1>Find routes that trade autopilot highways for real terrain.</h1>
      <p className="lead">
        Build custom motorcycle and 4x4 rides with tunable curve bias, scenic preference, highway
        avoidance, unpaved appetite, and difficulty level.
      </p>
      <div className="hero-actions">
        <Link to="/plan" className="btn-primary">
          Start Planning
        </Link>
        <Link to="/signup" className="btn-secondary">
          Create Account
        </Link>
      </div>
    </section>
  );
}
