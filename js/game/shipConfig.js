// The player's ship model. Drop a .glb at `url`; if it's missing the built-in boat is used.
// The loader auto-orients and scales it. Tweak these if it comes out wrong:
export const SHIP_MODEL = {
  url: 'assets/ship.glb',
  length: 7.4,      // bow-to-stern length in world units (the river is 18 wide)
  draft: 0.35,      // how far the keel sits below the waterline
  flip: true,       // true if the ship sails backwards
  yaw: 0,           // extra rotation in radians, for models that aren't axis-aligned
  deckHeight: 0.2,  // where cargo crates sit, as a fraction of the model's height
};
