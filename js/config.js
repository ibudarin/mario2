(function (root) {
  'use strict';

  var CONFIG = {
    VERSION: '1.0.0',
    STEP: 1 / 120,
    MAX_FRAME_DT: 0.1,

    WALK_SPEED: 6.0,
    RUN_SPEED: 9.8,
    ACCEL_GROUND: 38.0,
    ACCEL_AIR: 27.0,
    BRAKE_GROUND: 32.0,
    BRAKE_AIR: 8.0,
    GRAVITY: -40.0,
    JUMP_SPEED: 21.0,
    RUN_JUMP_BOOST: 1.2,
    MAX_FALL: 34.0,
    COYOTE_TIME: 0.12,
    JUMP_BUFFER: 0.16,
    STOMP_BOUNCE: 12.0,
    STOMP_BOUNCE_HELD: 16.0,
    DEATH_Y: -6.0,

    PLAYER_HALF_W: 0.35,
    HEIGHT_SMALL: 1.6,
    HEIGHT_BIG: 2.5,
    HEIGHT_DUCK: 1.2,

    GOOMBA_SPEED: 1.65,
    KOOPA_SPEED: 1.35,
    SHELL_SPEED: 12.0,
    SHELL_WAKE_TIME: 5.0,
    SHELL_WARN_TIME: 1.0,
    SHELL_KICK_GRACE: 0.35,
    ENEMY_ACTIVATE_DIST: 30.0,

    MUSHROOM_SPEED: 3.1,
    STAR_TIME: 10.0,
    INVULN_TIME: 2.2,
    GROW_FREEZE: 0.5,

    FIREBALL_SPEED: 13.0,
    FIREBALL_COOLDOWN: 0.25,
    FIREBALL_MAX: 2,
    FIREBALL_LIFE: 3.0,
    FIREBALL_BOUNCE: 9.0,

    TIMER_START: 300,
    TIMER_UNIT_SECONDS: 0.4,
    TIMER_HURRY_AT: 100,
    LIVES_START: 3,
    COINS_PER_LIFE: 100,
    MULTI_COIN_PAYOUT: 10,

    SCORE_COIN: 200,
    SCORE_POWERUP: 1000,
    SCORE_BRICK: 50,
    SCORE_KILL: 100,
    SCORE_FIREWORK: 500,
    SCORE_TIME_UNIT: 50,
    FLAG_BONUS: [
      { min: 7.0, points: 5000 },
      { min: 5.0, points: 2000 },
      { min: 3.0, points: 800 },
      { min: 1.0, points: 400 },
      { min: -99.0, points: 100 }
    ],

    STOMP_CHAIN: [100, 200, 400, 800, 1000, 2000, 4000, 8000, '1UP'],
    SHELL_CHAIN: [500, 800, 1000, 2000, 4000, 5000, 8000, '1UP'],

    START_X: -56.0,
    CHECKPOINT_X: 55.0,
    FLAG_X: 134.0,
    CASTLE_X: 141.0,
    DEATH_HOP: 14.0,

    CELLAR_ENTER_PIPE_X: -12.0,
    CELLAR_EXIT_X: 48.0,
    CELLAR_SPAWN_X: 201.5,
    CELLAR_SPAWN_Y: -6.0,
    CELLAR_EXIT_TRIGGER_X: 214.6,

    COLORS: {
      sky: 0x9dd8ed,
      hillFar: 0xa8e0c8,
      hillNear: 0x7cc9a0,
      grass: 0x4fae3d,
      soil: 0x9c6b3f,
      soilDark: 0x7a4f2e,
      brick: 0xc0622e,
      mortar: 0xe8d5b5,
      question: 0xf2b632,
      coin: 0xffd23e,
      used: 0x8a6a4a,
      pipe: 0x2fae4a,
      pipeDark: 0x1d7a31,
      uiBack: '#263B36',
      uiText: '#FFF6D9'
    }
  };

  root.LPMConfig = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof self !== 'undefined' ? self : globalThis);
