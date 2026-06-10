// Fixed-timestep accumulator. advance(elapsedMs) runs `tick(dt)` as many
// whole dt-steps as fit, returns the number of steps taken. Pure & testable:
// the host (main.js) supplies elapsed time from requestAnimationFrame.
export function createLoop({ tick, dt = 1000 / 30, maxSteps = 5 }) {
  let acc = 0;
  return {
    advance(elapsedMs) {
      acc += elapsedMs;
      let steps = 0;
      while (acc >= dt && steps < maxSteps) {
        tick(dt);
        acc -= dt;
        steps++;
      }
      if (steps === maxSteps && acc >= dt) acc = 0; // drop backlog when overloaded
      return steps;
    },
    get accumulator() {
      return acc;
    },
  };
}
