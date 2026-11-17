// Tuning constants shared by every system of Palm Harbor: Heatwave.

export const GAME_TITLE = 'PALM HARBOR';
export const GAME_TAGLINE = 'HEATWAVE';

/** Fixed simulation step, in seconds. */
export const STEP = 1 / 60;
/** World size in world units (one unit is one pixel at zoom 1; a car is about 46 long). */
export const WORLD_W = 5700;
export const WORLD_H = 4400;
export const LANE_W = 26;
export const SIDEWALK_W = 16;
/** Height of the virtual camera above the street: buildings lean away from the view centre by z / CAMERA_HEIGHT. */
export const CAMERA_HEIGHT = 1000;
/** Ground is painted once into square tiles of this size and reused. */
export const CHUNK = 512;

/** The in-game clock starts at golden hour; one game minute passes each real second. */
export const START_CLOCK = 17.4;
export const CLOCK_RATE = 1 / 60;

export const SAVE_KEY = 'palmharbor.heatwave.save.v1';
export const SETTINGS_KEY = 'palmharbor.heatwave.settings.v1';

export const MAX_TRAFFIC = 20;
export const MAX_PEDESTRIANS = 34;
/** Vehicles and pedestrians outside this radius of the camera are recycled. */
export const DESPAWN_RADIUS = 1500;

export const UI_FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
export const DISPLAY_FONT = 'Impact, "Arial Black", "Trebuchet MS", sans-serif';
