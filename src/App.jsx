import { useEffect, useState } from 'react';
import Admin from './components/Admin.jsx';
import Questionnaire from './components/Questionnaire.jsx';
import { readLink } from './lib/link.js';

// Hash routes keep everything client-side (no server rewrites, and link data never reaches a server):
//   #/q/<packed link>  → client questionnaire
//   #/questionnaire    → generic questionnaire (no client name)
//   anything else      → your admin workspace
export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const link = readLink(hash);
  if (link) return <Questionnaire key={link.id} link={link} />;
  if (hash.startsWith('#/questionnaire')) return <Questionnaire link={{ id: 'open', company: '', contact: '', consultant: '', email: '', due: '', custom: [] }} />;
  if (hash.startsWith('#/q/')) return <BadLink />;
  return <Admin />;
}

function BadLink() {
  return (
    <div className="empty-state" style={{ minHeight: '80vh', justifyContent: 'center' }}>
      <h1>This questionnaire link looks incomplete</h1>
      <p>It may have been cut off when it was copied. Please ask for the link again, or paste the whole link into your browser.</p>
    </div>
  );
}
