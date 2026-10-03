import { IconBookmark, IconRepeat, IconSpeed } from './Icons';
import { VideoLoader } from './VideoLoader';
import { useFocusHeading } from '../state/hooks';
import type { View } from '../types';

const features = [
  {
    title: 'Slow down',
    copy: 'Practice difficult sections at your own speed.',
    icon: <IconSpeed />,
  },
  {
    title: 'A/B loop',
    copy: "Repeat any section until you've got it.",
    icon: <IconRepeat />,
  },
  {
    title: 'Save practice loops',
    copy: 'Save useful sections for later.',
    icon: <IconBookmark />,
  },
];

export function EmptyState({ view }: { view: View }) {
  const headingRef = useFocusHeading('practice', view === 'practice');

  return (
    <section className="hero" aria-labelledby="empty-title">
      <h1 id="empty-title" data-view-title tabIndex={-1} ref={headingRef}>
        Practice smarter.
      </h1>
      <p className="hero-lede">Slow down. Loop. Learn.</p>
      <VideoLoader prominent />
      <div className="feature-grid">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <span className="feature-icon">{feature.icon}</span>
            <h2 className="feature-label">{feature.title}</h2>
            <p className="feature-copy">{feature.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
