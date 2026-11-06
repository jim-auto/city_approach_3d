export const ACTIONS = [
  { id: 'wave', label: '手を振る', icon: '👋', key: 'e', duration: 1.8 },
  { id: 'bow', label: '会釈', icon: '🙇', key: 'b', duration: 1.5 },
  { id: 'jump', label: 'ジャンプ', icon: '↑', key: ' ', duration: .85 },
  { id: 'dance', label: 'ダンス', icon: '♫', key: 'q', duration: 3.2 },
];

// Apply after the ordinary pose. All transforms are relative to the current pose;
// the normal animation restores them on the next frame, including after cancellation.
export function animateAction(model, id, elapsed) {
  const action = ACTIONS.find(a => a.id === id);
  if (!action || elapsed < 0 || elapsed >= action.duration) return false;
  const { body, head, arms, elbows, legs, knees } = model.userData;
  const t = elapsed / action.duration;
  const envelope = Math.min(1, elapsed / .2, (action.duration - elapsed) / .2);
  if (id === 'wave') {
    arms[1].rotation.z = 2.45 * envelope;
    elbows[1].rotation.x = -.4 * envelope;
    elbows[1].rotation.z = Math.sin(elapsed * 15) * .42 * envelope;
    head.rotation.z = -.09 * envelope;
  } else if (id === 'bow') {
    const angle = .5 * Math.sin(Math.PI * t) ** 2;
    body.rotation.x = angle;
    body.position.y += .95 * (1 - Math.cos(angle)); body.position.z = -.95 * Math.sin(angle);
    head.rotation.x = .17 * envelope;
    arms.forEach(arm => arm.rotation.x = -.1 * envelope);
  } else if (id === 'jump') {
    const lift = 1.15 * Math.sin(Math.PI * t);
    body.position.y += lift; legs.forEach(leg => leg.position.y += lift);
    arms[0].rotation.z = -.9 * envelope; arms[1].rotation.z = .9 * envelope;
    knees.forEach(knee => knee.rotation.x = .42 * Math.sin(Math.PI * t));
  } else {
    const beat = Math.sin(elapsed * 9);
    body.rotation.z = beat * .16 * envelope;
    body.rotation.y = Math.sin(elapsed * 4.5) * .32 * envelope;
    body.position.y += Math.abs(beat) * .11 * envelope;
    arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * (1.3 + beat * .5) * envelope; elbows[i].rotation.x = -.7 * envelope; });
    legs.forEach((leg, i) => { leg.rotation.x = (i ? -beat : beat) * .28 * envelope; knees[i].rotation.x = Math.max(0, i ? beat : -beat) * .45 * envelope; });
  }
  return true;
}
