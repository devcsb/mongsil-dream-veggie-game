/**
 * Pure Mario-like platformer physics.
 * Shared by the browser game loop and Node unit tests (no DOM).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MongsilPhysics = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    maxRunSpeed: 420,
    groundAccel: 2600,
    airAccel: 1680,
    skidAccel: 5400,
    groundFriction: 11,
    airFriction: 1.8,
    jumpSpeed: 760,
    jumpHoldGravity: 1550,
    riseGravity: 2100,
    fallGravity: 2900,
    jumpCutFactor: 0.42,
    jumpCutThreshold: -80,
    maxFallSpeed: 1100,
    coyoteTime: 0.12,
    jumpBufferTime: 0.14
  });

  /**
   * Facing used for sprite scaleX.
   * facingDir +1 = want/move right, -1 = left.
   * assets/snail.png is authored facing RIGHT (shell trails on the left at scaleX +1).
   * So render scaleX equals facingDir: right → +1, left → -1.
   */
  function facingRenderScale(facingDir) {
    return facingDir >= 0 ? 1 : -1;
  }

  function facingFromVelocityOrInput(vx, inputDir, currentFacing) {
    if (inputDir !== 0) return inputDir > 0 ? 1 : -1;
    if (Math.abs(vx) > 12) return vx > 0 ? 1 : -1;
    return currentFacing >= 0 ? 1 : -1;
  }

  /**
   * One horizontal physics step.
   * @param {{ vx:number, grounded:boolean, facing:number }} body
   * @param {{ left?:boolean, right?:boolean }} input
   * @param {number} dt
   * @param {object} [cfg]
   * @returns {{ vx:number, facing:number, runDelta:number, skidding:boolean }}
   */
  function stepHorizontal(body, input, dt, cfg) {
    const c = cfg || DEFAULTS;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let vx = body.vx;
    let skidding = false;
    let runDelta = 0;

    if (dir !== 0) {
      const opposing = Math.sign(vx) !== 0 && Math.sign(vx) !== dir;
      if (body.grounded && opposing) {
        skidding = true;
        vx += dir * c.skidAccel * dt;
      } else {
        const accel = body.grounded ? c.groundAccel : c.airAccel;
        vx += dir * accel * dt;
      }
      if (vx > c.maxRunSpeed) vx = c.maxRunSpeed;
      if (vx < -c.maxRunSpeed) vx = -c.maxRunSpeed;
      runDelta = Math.abs(vx) * dt * 0.022;
    } else {
      const friction = body.grounded ? c.groundFriction : c.airFriction;
      const factor = Math.max(0, 1 - friction * dt);
      vx *= factor;
      if (Math.abs(vx) < 4) vx = 0;
    }

    const facing = facingFromVelocityOrInput(vx, dir, body.facing);
    return { vx, facing, runDelta, skidding };
  }

  /**
   * Vertical jump + gravity step (no collision).
   * @param {{ vy:number, grounded:boolean, coyote:number, jumpBuffer:number }} body
   * @param {{ jumpHeld?:boolean, jumpQueued?:boolean }} input
   * @param {number} dt
   * @param {{ jumpJustReleased?:boolean }} flags  jumpJustReleased: true on the frame hold ends
   * @param {object} [cfg]
   * @returns {{ vy:number, grounded:boolean, coyote:number, jumpBuffer:number, didJump:boolean, jumpQueued:boolean }}
   */
  function stepVertical(body, input, dt, flags, cfg) {
    const c = cfg || DEFAULTS;
    let vy = body.vy;
    let grounded = body.grounded;
    let coyote = grounded ? c.coyoteTime : Math.max(0, body.coyote - dt);
    let jumpBuffer = Math.max(0, body.jumpBuffer - dt);
    let jumpQueued = !!input.jumpQueued;
    let didJump = false;

    if (jumpQueued) {
      jumpBuffer = c.jumpBufferTime;
      jumpQueued = false;
    }

    if (jumpBuffer > 0 && (grounded || coyote > 0)) {
      vy = -c.jumpSpeed;
      grounded = false;
      coyote = 0;
      jumpBuffer = 0;
      didJump = true;
    }

    // Variable jump: release while rising clamps upward speed (Mario jump cut).
    if (flags && flags.jumpJustReleased && vy < c.jumpCutThreshold) {
      vy *= c.jumpCutFactor;
    }

    let gravity;
    if (vy < 0) {
      gravity = input.jumpHeld ? c.jumpHoldGravity : c.riseGravity;
    } else {
      gravity = c.fallGravity;
    }
    // Extra hang cut while rising without hold (helps short hops even if cut already applied).
    if (!input.jumpHeld && vy < -160) {
      gravity = Math.max(gravity, c.fallGravity * 1.05);
    }

    vy = Math.min(c.maxFallSpeed, vy + gravity * dt);

    return { vy, grounded, coyote, jumpBuffer, didJump, jumpQueued };
  }

  /**
   * Full free-flight step (no world collision). Useful for trajectory tests.
   */
  function stepFree(body, input, dt, flags, cfg) {
    const h = stepHorizontal(body, input, dt, cfg);
    const v = stepVertical(
      {
        vy: body.vy,
        grounded: body.grounded,
        coyote: body.coyote,
        jumpBuffer: body.jumpBuffer
      },
      input,
      dt,
      flags,
      cfg
    );
    const x = body.x + h.vx * dt;
    const y = body.y + v.vy * dt;
    return {
      x,
      y,
      vx: h.vx,
      vy: v.vy,
      grounded: v.grounded,
      coyote: v.coyote,
      jumpBuffer: v.jumpBuffer,
      facing: h.facing,
      didJump: v.didJump,
      jumpQueued: v.jumpQueued,
      skidding: h.skidding,
      runDelta: h.runDelta
    };
  }

  /**
   * Integrate horizontal motion for duration with constant input (no collision).
   */
  function simulateHorizontal(startVx, grounded, input, duration, dt, cfg) {
    let body = { vx: startVx, grounded, facing: 1 };
    let t = 0;
    const samples = [{ t: 0, vx: startVx }];
    while (t < duration - 1e-9) {
      const step = Math.min(dt, duration - t);
      const next = stepHorizontal(body, input, step, cfg);
      body = { vx: next.vx, grounded, facing: next.facing };
      t += step;
      samples.push({ t, vx: body.vx, facing: body.facing, skidding: next.skidding });
    }
    return { vx: body.vx, facing: body.facing, samples };
  }

  /**
   * Free-flight jump simulation from grounded rest (or given vx).
   * holdTime: seconds jump is held after takeoff.
   */
  function simulateJumpTrajectory(options) {
    const cfg = options.cfg || DEFAULTS;
    const dt = options.dt || 1 / 60;
    const holdTime = options.holdTime == null ? 1 : options.holdTime;
    const airInput = options.airInput || { left: false, right: false };
    const startVx = options.startVx || 0;
    const maxTime = options.maxTime || 3;

    let body = {
      x: 0,
      y: 0,
      vx: startVx,
      vy: 0,
      grounded: true,
      coyote: cfg.coyoteTime,
      jumpBuffer: 0,
      facing: startVx >= 0 ? 1 : -1
    };

    let input = {
      left: false,
      right: false,
      jumpHeld: true,
      jumpQueued: true
    };

    let t = 0;
    let apexY = 0;
    let released = false;
    const path = [{ t: 0, x: 0, y: 0, vx: body.vx, vy: body.vy }];

    while (t < maxTime) {
      const step = dt;
      const prevVy = body.vy;
      const airborneBefore = !body.grounded;
      const flags = {};

      // After takeoff, switch to air lateral input.
      if (airborneBefore || body.vy < 0) {
        input.left = !!airInput.left;
        input.right = !!airInput.right;
      }

      if (!released && t >= holdTime && body.vy < 0) {
        input.jumpHeld = false;
        flags.jumpJustReleased = true;
        released = true;
      }

      const next = stepFree(body, input, step, flags, cfg);
      // Once airborne from jump, stay airborne in free-flight (no ground).
      if (next.didJump || body.vy < 0 || !body.grounded) {
        next.grounded = false;
      }
      // After first jump, clear queue.
      input.jumpQueued = next.jumpQueued;

      body = {
        x: next.x,
        y: next.y,
        vx: next.vx,
        vy: next.vy,
        grounded: next.grounded,
        coyote: next.coyote,
        jumpBuffer: next.jumpBuffer,
        facing: next.facing
      };
      t += step;
      if (body.y < apexY) apexY = body.y;
      path.push({ t, x: body.x, y: body.y, vx: body.vx, vy: body.vy });

      // Land when crossing y=0 going down (free-flight floor).
      if (t > 0.05 && body.y >= 0 && prevVy > 0) {
        body.y = 0;
        break;
      }
    }

    return {
      apexY,
      endX: body.x,
      endY: body.y,
      path,
      duration: t
    };
  }

  return {
    DEFAULTS,
    facingRenderScale,
    facingFromVelocityOrInput,
    stepHorizontal,
    stepVertical,
    stepFree,
    simulateHorizontal,
    simulateJumpTrajectory
  };
});
